import Link from "next/link";

export default function MeetupBackfillPreviewDemo(){
  return <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/admin/meetup-backfill" className="text-sm font-black text-lime-700">← ADMIN照合画面に戻る</Link>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">画面サンプル・ログイン不要</span>
    </div>

    <h1 className="mt-5 text-3xl font-black text-lime-950">🍀 Meetup履歴補完</h1>
    <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
      取得漏れしたMeetupを、ADMINが共有URLから照合するための画面イメージです。
      このページはサンプル専用で、本番データの検索・登録・更新は行いません。
    </p>

    <section className="clover-card mt-6 p-5 md:p-6">
      <label htmlFor="sample-url" className="block text-sm font-black text-lime-900">Meetup共有URL</label>
      <input id="sample-url" readOnly value="https://campfire.scopely.com/discover/meetup/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        className="mt-3 block w-full rounded-xl border border-lime-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
        aria-describedby="sample-description"/>
      <p id="sample-description" className="mt-2 text-xs font-semibold text-slate-500">
        実際のADMIN画面では、ここに短縮URLまたはCampfireのMeetup共有URLを入力します。
      </p>
      <button disabled className="mt-5 rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black text-lime-950 opacity-50">
        URLから照合する（サンプルでは無効）
      </button>
    </section>

    <section className="clover-card mt-6 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-lime-950">サンプルMeetup</h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">未登録（サンプル）</span>
      </div>
      <p className="mt-2 text-sm font-black text-lime-700">サンプルCommunity</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-xs font-semibold text-slate-500">開催日時</dt><dd className="mt-1 font-bold text-slate-900">10月24日 15:00</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">終了日時</dt><dd className="mt-1 font-bold text-slate-900">10月24日 16:00</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">作成日時</dt><dd className="mt-1 font-bold text-slate-900">10月24日 13:30</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">参加表明</dt><dd className="mt-1 font-bold text-slate-900">未取得</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">チェックイン</dt><dd className="mt-1 font-bold text-slate-900">未取得</dd></div>
        <div><dt className="text-xs font-semibold text-slate-500">所属照合</dt><dd className="mt-1 font-bold text-slate-900">照合待ち</dd></div>
      </dl>
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs font-semibold leading-6 text-slate-700">
        <p>🔒 現段階は確認用の試作です。保存機能は隔離検証中のため利用できません。</p>
        <p className="mt-1 text-slate-500">数値や名称はすべて架空の表示例です。</p>
      </div>
    </section>
  </main>;
}
