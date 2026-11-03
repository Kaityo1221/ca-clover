// Privacy-safe display states. Never interpolate raw error messages or API bodies.
const ERROR_MESSAGES = Object.freeze({
  BUSY: "現在CSVの取得が混み合っています。少し待ってから再試行してください。",
  INCOMPLETE: "参加者データを全件取得できなかったため、CSVの生成を中止しました。",
  TIMEOUT: "取得がタイムアウトしました。時間をおいて再試行してください。",
  FORBIDDEN: "このMeetupのCSVを取得する権限がありません。",
  NOT_FOUND: "対象のMeetupが見つかりません。",
  UNKNOWN: "CSVを取得できませんでした。しばらくしてから再試行してください。",
});

export function getPublicExportFailure(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const status = Number.isInteger(error?.status) ? error.status : null;
  let category = "UNKNOWN";
  if (status === 429 || code === "BUSY") category = "BUSY";
  else if (status === 401 || status === 403 || code === "FORBIDDEN") category = "FORBIDDEN";
  else if (status === 404 || code === "NOT_FOUND") category = "NOT_FOUND";
  else if (code === "INCOMPLETE") category = "INCOMPLETE";
  else if (code === "TIMEOUT" || error?.name === "AbortError") category = "TIMEOUT";
  return {
    category,
    message: ERROR_MESSAGES[category],
    retryable: ["BUSY", "INCOMPLETE", "TIMEOUT", "UNKNOWN"].includes(category),
  };
}
