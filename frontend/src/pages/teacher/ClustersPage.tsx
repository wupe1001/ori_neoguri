import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { getLessonDraft } from "../../api/ai";
import { USE_MOCK } from "../../api/client";
import { getClasses } from "../../api/notices";
import {
  getUnitGroups,
  subscribeQuestions,
  type UnitGroup,
} from "../../api/questions";
import Button from "../../components/Button";
import Card from "../../components/Card";
import { cn } from "../../components/cn";
import Loading from "../../components/Loading";
import { ROUTES } from "../../routes";
import { useTeacher } from "../../session/session";
import type { Question, QuestionCategory } from "../../types/question";
import type { ClassRef } from "../../types/user";

type Period = "today" | "week" | "all";
const PERIODS: [Period, string][] = [
  ["today", "오늘"],
  ["week", "최근 7일"],
  ["all", "전체"],
];
const CATEGORIES: (QuestionCategory | "전체")[] = [
  "전체",
  "교과",
  "수행평가",
  "생활",
  "고민",
];

const classKey = (c: ClassRef) => `${c.grade}-${c.classNo}`;

function inPeriod(iso: string, period: Period) {
  const date = new Date(iso);
  const now = new Date();
  if (period === "today") return date.toDateString() === now.toDateString();
  if (period === "week")
    return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  return true;
}

// 질문한 학생 수 (같은 학생이 여러 번 물어도 1명)
const studentCount = (questions: Question[]) =>
  new Set(questions.map((q) => q.studentId)).size;

type Data = { groups: UnitGroup[]; ungrouped: Question[] };

export default function ClustersPage() {
  const teacher = useTeacher();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("week");
  const [category, setCategory] = useState<QuestionCategory | "전체">("전체");

  // 단원별로 묶인 질문을 불러오고, 새 질문이 오면 다시 불러온다.
  // 실제 백엔드는 단원마다 요청을 보내므로 15초마다만 갱신한다.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [next, classList] = await Promise.all([
          getUnitGroups(teacher),
          USE_MOCK ? getClasses() : [],
        ]);
        if (cancelled) return;
        setData(next);
        setClasses(classList);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    const unsubscribe = subscribeQuestions(load, 15000);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [teacher]);

  // 과목 칩: 질문이 하나라도 있는 과목만
  const subjects = useMemo(
    () => [
      ...new Set(
        data?.groups
          .filter((g) => g.questions.length > 0)
          .flatMap((g) => g.subjectName ?? []),
      ),
    ],
    [data],
  );

  const view = useMemo(() => {
    if (!data) return null;
    const keep = (q: Question) =>
      (classFilter === "all" || classKey(q.author) === classFilter) &&
      inPeriod(q.createdAt, period) &&
      (category === "전체" || q.category === category);
    const groups = data.groups
      .filter((g) => subject === "all" || g.subjectName === subject)
      .map((g) => ({ ...g, questions: g.questions.filter(keep) }))
      .filter((g) => g.questions.length > 0)
      .sort(
        (a, b) =>
          studentCount(b.questions) - studentCount(a.questions) ||
          b.questions.length - a.questions.length,
      );
    const ungrouped = data.ungrouped.filter(
      (q) => keep(q) && (subject === "all" || q.subjectName === subject),
    );
    return { groups, ungrouped };
  }, [data, classFilter, subject, period, category]);

  if (error && !data)
    return (
      <p className="py-12 text-center text-muted">
        질문 묶음을 불러오지 못했어요
      </p>
    );
  if (!view) return <Loading message="단원별로 질문을 모으고 있어요…" />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1>질문 묶음</h1>
        <p className="mt-1 text-caption text-muted">
          {USE_MOCK
            ? "AI가 비슷한 질문을 개념별로 묶었어요. 반 전체가 막힌 곳을 보고 다음 수업을 준비해요."
            : "학생 질문을 단원별로 모았어요. 많이 막힌 단원부터 보고 다음 수업을 준비해요."}
        </p>
      </div>

      {/* 과목 · 반 · 기간 · 유형 */}
      <div className="flex flex-col gap-2">
        {subjects.length > 1 && (
          <Chips
            options={[
              ["all", "전체 과목"],
              ...subjects.map((s): [string, string] => [s, s]),
            ]}
            value={subject}
            onChange={setSubject}
          />
        )}
        {/* 실제 백엔드는 학년·반과 질문 유형을 주지 않아서 목업에서만 보여준다 */}
        {USE_MOCK && (
          <Chips
            options={[
              ["all", "전체 반"],
              ...classes.map((c): [string, string] => [
                classKey(c),
                `${c.grade}-${c.classNo}반`,
              ]),
            ]}
            value={classFilter}
            onChange={setClassFilter}
          />
        )}
        <Chips options={PERIODS} value={period} onChange={setPeriod} />
        {USE_MOCK && (
          <Chips
            options={CATEGORIES.map((c): [typeof c, string] => [c, c])}
            value={category}
            onChange={setCategory}
          />
        )}
      </div>

      {view.groups.length === 0 ? (
        <p className="py-12 text-center text-muted">
          이 조건에서 묶인 질문이 없어요
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {view.groups.map((g, i) => (
            <li key={g.key}>
              <ClusterCard group={g} rank={i + 1} />
            </li>
          ))}
        </ul>
      )}

      {view.ungrouped.length > 0 && (
        <p className="text-center text-caption text-muted">
          {USE_MOCK ? "묶이지 않은" : "단원이 정해지지 않은"} 질문{" "}
          {view.ungrouped.length}개는 질문함에서 볼 수 있어요
        </p>
      )}
    </div>
  );
}

function ClusterCard({ group, rank }: { group: UnitGroup; rank: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const students = studentCount(group.questions);
  const path = [group.subjectName, group.course].filter(Boolean).join(" · ");

  const makeDraft = async () => {
    setLoading(true);
    try {
      setDraft(
        await getLessonDraft({
          topic: group.unitName,
          questions: group.questions,
          studentCount: students,
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      // 복사가 막힌 환경이면 직접 선택해서 복사한다
    }
  };

  return (
    <Card className={cn(rank === 1 && "border-primary-200")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {path && <p className="text-caption text-muted">{path}</p>}
          <p className="font-semibold">
            <span className="mr-1 text-primary-600">{rank}</span>{" "}
            {group.unitName}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-caption font-semibold text-primary-700">
          학생 {students}명
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-1">
        {group.questions.slice(0, 3).map((q) => (
          <li key={q.id} className="line-clamp-1 text-caption text-muted">
            <Link
              to={ROUTES.TEACHER.INBOX_DETAIL(q.id)}
              className="hover:text-ink"
            >
              · {q.rewrittenText || q.originalText}
            </Link>
          </li>
        ))}
        {group.questions.length > 3 && (
          <li className="text-caption text-muted">
            외 {group.questions.length - 3}개
          </li>
        )}
      </ul>

      {draft ? (
        <div className="mt-3 rounded-xl bg-primary-50 p-3">
          <p className="text-caption font-semibold text-primary-700">
            AI 보충 설명 초안
          </p>
          <p className="mt-1 whitespace-pre-line text-caption text-ink">
            {draft}
          </p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={copy}>
            {copied ? "복사했어요" : "복사하기"}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          disabled={loading}
          onClick={makeDraft}
        >
          {loading ? "AI가 쓰고 있어요…" : "다음 수업 보충 설명 초안"}
        </Button>
      )}
    </Card>
  );
}

// 가로로 스크롤되는 선택 칩
function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-caption",
            value === v
              ? "border-primary-600 bg-primary-600 text-white"
              : "border-line text-muted hover:border-primary-200 hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
