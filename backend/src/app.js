import express from 'express';
import session from 'express-session';
import swaggerUi from 'swagger-ui-express';
import { existsSync, readFileSync } from 'node:fs';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { noticesRouter } from './routes/notices.js';
import { studentQuestionsRouter } from './routes/student-questions.js';
import { subjectsRouter } from './routes/subjects.js';
import { teacherQuestionsRouter } from './routes/teacher-questions.js';
import { filesRouter } from './routes/files.js';
import { usersRouter } from './routes/users.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false },
}));

const swaggerPath = new URL('../swagger-output.json', import.meta.url);
if (existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(readFileSync(swaggerPath, 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    swaggerOptions: { withCredentials: true },
  }));
}

app.get('/', (_req, res) => {
  /* #swagger.tags = ['Service']
     #swagger.summary = '서비스 상태 확인'
     #swagger.description = '백엔드 서버가 정상적으로 요청을 처리할 수 있는지 확인합니다.'
     #swagger.responses[200] = { description: '서버가 정상 동작 중입니다.' }
  */
  res.json({ service: 'ori-neoguri-backend', status: 'ok' });
});
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/questions', studentQuestionsRouter);
app.use('/api/teacher/questions', teacherQuestionsRouter);
app.use('/api/files', filesRouter);
app.use(notFoundHandler);
app.use(errorHandler);
