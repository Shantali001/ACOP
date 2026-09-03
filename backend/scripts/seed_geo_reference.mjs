import { config } from 'dotenv';
import { pool } from '../src/db/pool.js';

config();

async function main() {
  const states = [
    { name: 'Abia' }, { name: 'Adamawa' }, { name: 'Akwa Ibom' }, { name: 'Anambra' },
    { name: 'Bauchi' }, { name: 'Bayelsa' }, { name: 'Benue' }, { name: 'Borno' },
    { name: 'Cross River' }, { name: 'Delta' }, { name: 'Ebonyi' }, { name: 'Edo' },
    { name: 'Ekiti' }, { name: 'Enugu' }, { name: 'FCT' }, { name: 'Gombe' },
    { name: 'Imo' }, { name: 'Jigawa' }, { name: 'Kaduna' }, { name: 'Kano' },
    { name: 'Katsina' }, { name: 'Kebbi' }, { name: 'Kogi' }, { name: 'Kwara' },
    { name: 'Lagos' }, { name: 'Nasarawa' }, { name: 'Niger' }, { name: 'Ogun' },
    { name: 'Ondo' }, { name: 'Osun' }, { name: 'Oyo' }, { name: 'Plateau' },
    { name: 'Rivers' }, { name: 'Sokoto' }, { name: 'Taraba' }, { name: 'Yobe' },
    { name: 'Zamfara' },
  ];

  const lgas = [
    { name: 'Demo LGA', stateName: 'Demo State' },
    { name: 'Ikeja', stateName: 'Lagos' },
    { name: 'Surulere', stateName: 'Lagos' },
    { name: 'Wuse', stateName: 'FCT' },
    { name: 'Garki', stateName: 'FCT' },
  ];

  const wards = [
    { name: 'Ward 1', lgaName: 'Demo LGA', stateName: 'Demo State' },
    { name: 'Ward 2', lgaName: 'Demo LGA', stateName: 'Demo State' },
    { name: 'Ikeja North', lgaName: 'Ikeja', stateName: 'Lagos' },
    { name: 'Ikeja South', lgaName: 'Ikeja', stateName: 'Lagos' },
    { name: 'Wuse I', lgaName: 'Wuse', stateName: 'FCT' },
  ];

  const pollingUnits = [
    { puCode: 'PU-001', puName: 'Demo PU 1', wardName: 'Ward 1', lgaName: 'Demo LGA', stateName: 'Demo State', registeredVoters: 500 },
    { puCode: 'PU-002', puName: 'Demo PU 2', wardName: 'Ward 2', lgaName: 'Demo LGA', stateName: 'Demo State', registeredVoters: 450 },
    { puCode: 'PU-003', puName: 'Ikeja PU 1', wardName: 'Ikeja North', lgaName: 'Ikeja', stateName: 'Lagos', registeredVoters: 600 },
    { puCode: 'PU-004', puName: 'Wuse PU 1', wardName: 'Wuse I', lgaName: 'Wuse', stateName: 'FCT', registeredVoters: 550 },
  ];

  await pool.query('BEGIN');

  try {
    for (const state of states) {
      await pool.query('INSERT INTO states (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [state.name]);
    }

    for (const lga of lgas) {
      await pool.query(
        `INSERT INTO lgas (name, state_id) SELECT $1, s.id FROM states s WHERE s.name = $2 ON CONFLICT (name, state_id) DO NOTHING`,
        [lga.name, lga.stateName],
      );
    }

    for (const ward of wards) {
      await pool.query(
        `INSERT INTO wards (name, lga_id) SELECT $1, l.id FROM lgas l JOIN states s ON s.id = l.state_id WHERE l.name = $2 AND s.name = $3 ON CONFLICT (name, lga_id) DO NOTHING`,
        [ward.name, ward.lgaName, ward.stateName],
      );
    }

    for (const pu of pollingUnits) {
      await pool.query(
        `INSERT INTO polling_units (pu_code, pu_name, ward_id, registered_voters)
         SELECT $1, $2, w.id, $3
         FROM wards w
         JOIN lgas l ON l.id = w.lga_id
         JOIN states s ON s.id = l.state_id
         WHERE w.name = $4 AND l.name = $5 AND s.name = $6
         ON CONFLICT (pu_code) DO NOTHING`,
        [pu.puCode, pu.puName, pu.registeredVoters, pu.wardName, pu.lgaName, pu.stateName],
      );
    }

    await pool.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
