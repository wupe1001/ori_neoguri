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
        NoticeRequest: {
            $title: '중간고사 일정 안내',
            $content: '중간고사는 11월 20일부터 진행합니다.',
        },
        QuestionRequest: {
            $content: '중간고사는 언제 시작하나요?',
        },
        QuestionDetailsRequest: {
            $who: '저와 같은 반 학생들이',
            $when: '오늘 점심시간에',
            $where: '교실에서',
            $what: '과제 제출 방법을',
            $how: '서로 다르게 안내받아',
            $why: '정확한 제출 방법을 확인하고 싶습니다',
        },
        QuestionConfirmationRequest: {
            $content: '오늘 점심시간에 안내받은 과제의 정확한 제출 방법을 알려 주세요.',
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
