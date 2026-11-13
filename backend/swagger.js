import 'dotenv/config';
import swaggerAutogen from 'swagger-autogen';

const generateSwagger = swaggerAutogen();

const document = {
    info: {
        title: 'Ori Neoguri API',
        version: '1.0.0',
        description: 'API documentation for Ori Neoguri backend',
    },
    // host와 schemes를 생략하면 Swagger UI를 연 현재 서버를 호출한다.
    // localhost를 고정하면 다른 PC나 배포 주소에서 Try it out이 동작하지 않는다.
    host: null,
    schemes: null,
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
        { name: 'Service', description: '서비스 상태 확인' },
        { name: 'Auth', description: '세션 로그인 및 로그아웃' },
        { name: 'Users', description: 'ID 기반 사용자 계정 정보 조회' },
        { name: 'Subjects', description: '질문을 배정할 과목 조회' },
        { name: 'Notices', description: '학교 공지사항 조회 및 등록' },
        { name: 'Student Questions', description: '학생 질문 제출, 보완 및 답변 확인' },
        { name: 'Teacher Questions', description: '교사에게 배정된 질문 확인 및 답변 등록' },
    ],
    definitions: {
        LoginRequest: {
            $loginId: 'student01',
            $password: 'plain-password',
        },
        UserResponse: {
            $id: 1,
            $loginId: 'teacher01',
            $nickname: '김선생',
            $role: 'TEACHER',
            homeroomTeacherId: 1,
            $createdAt: '2026-11-13T00:00:00.000Z',
        },
        NoticeRequest: {
            $title: '중간고사 일정 안내',
            $content: '중간고사는 11월 20일부터 진행합니다.',
        },
        QuestionRequest: {
            $content: '중간고사는 언제 시작하나요?',
        },
        ImprovementAnswerRequest: {
            $answer: '과거시제와 무엇이 다른지 헷갈려요.',
        },
        FinalQuestionRequest: {
            $content: 'I have lost my key와 I lost my key의 차이와 시험에서 구분하는 방법을 알려 주세요.',
        },
        SubjectSelectionRequest: {
            $subjectId: 1,
        },
        AnswerRequest: {
            $content: '과제는 이번 주 금요일까지 온라인으로 제출하면 됩니다.',
        },
    },
};

await generateSwagger('./swagger-output.json', ['./src/app.js'], document);
