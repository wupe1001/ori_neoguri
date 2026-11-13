// className 합치기: 조건부 클래스에서 false/undefined는 빠진다.
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
