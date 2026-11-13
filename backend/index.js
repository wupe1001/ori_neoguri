import 'dotenv/config';
import { app } from './src/app.js';
import { config } from './src/config.js';
import { seedDatabase } from './src/db/database.js';

try {
  seedDatabase();
} catch (error) {
  console.error(`초기 데이터 검증 실패: ${error.message}`);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
});
