type ActivityBucket = "day" | "week" | "month" | "year";

type ActivityPoint = {
  bucket?: string;
  month?: string;
  meetup_count: number;
  checkin_count: number;
};

type Props = {
  data: ActivityPoint[];
  bucket?: ActivityBucket;
  periodLabel?: string;
};

const WIDTH = 980;
const HEIGHT = 330;
const MARGIN = { top: 30, right: 72, bottom: 54, left: 58 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;
  const niceFraction =
    fraction <= 1 ? 1 :
    fraction <= 2 ? 2 :
    fraction <= 2.5 ? 2.5 :
    fraction <= 5 ? 5 : 10;
  return niceFraction * base;
}

function compact(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function bucketLabel(value: string, bucket: ActivityBucket, pointCount: number) {
  const parts = value.slice(0, 10).split("-").map(Number);
  const year = parts[0] || 0;
  const month = parts[1] || 1;
  const day = parts[2] || 1;

  if (bucket === "day") return month + "/" + day;
  if (bucket === "week") return month + "/" + day;
  if (bucket === "year") return String(year);
  return pointCount > 12 ? String(year).slice(-2) + "/" + month : month + "月";
}

export default function ActivityTrendChart({
  data,
  bucket = "month",
  periodLabel = "過去12か月",
}: Props) {
  const points = data.map((row) => ({
    bucket: row.bucket ?? row.month ?? "",
    meetup_count: Number(row.meetup_count) || 0,
    checkin_count: Number(row.checkin_count) || 0,
  }));

  const meetupMax = niceMax(Math.max(1, ...points.map((row) => row.meetup_count)));
  const checkinMax = niceMax(Math.max(1, ...points.map((row) => row.checkin_count)));
  const tickCount = 5;
  const xStep = PLOT_WIDTH / Math.max(1, points.length);
  const barWidth = Math.min(28, Math.max(5, xStep * 0.34));
  const labelEvery = points.length <= 14 ? 1 : Math.ceil(points.length / 10);

  const xAt = (index: number) => MARGIN.left + xStep * index + xStep / 2;
  const meetupY = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / meetupMax) * PLOT_HEIGHT;
  const checkinY = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / checkinMax) * PLOT_HEIGHT;

  const linePoints = points
    .map((row, index) => xAt(index) + "," + checkinY(row.checkin_count))
    .join(" ");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-300" />
          Meetup回数
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 bg-lime-600" />
          <span className="inline-block size-2 rounded-full bg-lime-600" />
          Check-in数
        </span>
        <span className="text-slate-400">
          左軸: Meetup回数 / 右軸: Check-in数
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-lime-100 bg-white">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block min-w-[820px] w-full"
          role="img"
          aria-label={periodLabel + "のMeetup回数とCheck-in数の推移"}
        >
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="white" />

          {Array.from({ length: tickCount }, (_, index) => {
            const ratio = index / (tickCount - 1);
            const y = MARGIN.top + PLOT_HEIGHT - ratio * PLOT_HEIGHT;
            const meetupTick = Math.round(meetupMax * ratio);
            const checkinTick = Math.round(checkinMax * ratio);

            return (
              <g key={index}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeDasharray={index === 0 ? undefined : "4 5"}
                  strokeWidth="1"
                />
                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                >
                  {meetupTick}
                </text>
                <text
                  x={WIDTH - MARGIN.right + 10}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="11"
                  fill="#64748b"
                >
                  {compact(checkinTick)}
                </text>
              </g>
            );
          })}

          <line
            x1={MARGIN.left}
            x2={MARGIN.left}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="#cbd5e1"
          />
          <line
            x1={WIDTH - MARGIN.right}
            x2={WIDTH - MARGIN.right}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="#cbd5e1"
          />

          {points.map((row, index) => {
            const x = xAt(index);
            const y = meetupY(row.meetup_count);
            const height = MARGIN.top + PLOT_HEIGHT - y;
            const showLabel = index % labelEvery === 0 || index === points.length - 1;

            return (
              <g key={row.bucket}>
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={Math.max(0, height)}
                  rx="4"
                  fill="#fcd34d"
                >
                  <title>
                    {bucketLabel(row.bucket, bucket, points.length) + " Meetup " + row.meetup_count + "回"}
                  </title>
                </rect>
                {showLabel ? (
                  <text
                    x={x}
                    y={HEIGHT - 28}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#475569"
                  >
                    {bucketLabel(row.bucket, bucket, points.length)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {points.length > 1 ? (
            <polyline
              points={linePoints}
              fill="none"
              stroke="#65a30d"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {points.map((row, index) => {
            const x = xAt(index);
            const y = checkinY(row.checkin_count);

            return (
              <g key={"checkin-" + row.bucket}>
                <circle
                  cx={x}
                  cy={y}
                  r="4.5"
                  fill="#65a30d"
                  stroke="white"
                  strokeWidth="2"
                >
                  <title>
                    {bucketLabel(row.bucket, bucket, points.length) +
                      " Check-in " +
                      row.checkin_count.toLocaleString("ja-JP")}
                  </title>
                </circle>
              </g>
            );
          })}

          <text
            x={MARGIN.left}
            y="16"
            fontSize="10"
            fontWeight="800"
            fill="#b45309"
          >
            Meetup回数
          </text>
          <text
            x={WIDTH - MARGIN.right}
            y="16"
            textAnchor="end"
            fontSize="10"
            fontWeight="800"
            fill="#4d7c0f"
          >
            Check-in数
          </text>
        </svg>
      </div>

      {points.length <= 16 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {points.map((row) => (
            <div
              key={"summary-" + row.bucket}
              className="rounded-xl bg-lime-50/70 px-3 py-2"
            >
              <div className="font-black text-slate-500">
                {bucketLabel(row.bucket, bucket, points.length)}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-bold">
                <span className="text-amber-700">🔥 {row.meetup_count}回</span>
                <span className="text-lime-700">
                  ✅ {row.checkin_count.toLocaleString("ja-JP")}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
