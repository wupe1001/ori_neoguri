import 'dotenv/config';
import { db, seedDatabase } from './database.js';

seedDatabase();
console.log(`SQLite 초기화 완료: ${db.name}`);
db.close();
