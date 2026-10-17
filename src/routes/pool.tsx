import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { listSeedIntentsFn } from "@/lib/api/data.functions";
import { useAuth } from "@/lib/auth";
import { useMyIntents, useSavedBootstrap, useSavedWishes } from "@/data/hooks";
import { toggleSaved } from "@/lib/saved-intents";
import { hydrateSignups, listSignups, subscribeSignups, toggleSignup } from "@/lib/wish-signups";
import {
  ELDER_THEMES,
  elderDemoIntents,
  isElderPoolIntent,
  type ElderCost,
  type ElderHeadcount,
  type ElderPace,
} from "@/lib/elder-demo-intents";
import { loadMyIntents, publishMyIntent, type Intent } from "@/lib/intents";
import { CantoneseListenButton, CantoneseMicButton } from "@/components/cantonese-voice";
import { AccountMenu } from "@/components/account-menu";
import { showPhrase } from "@/lib/elder-phrases";

function useShowZh() {
  const { i18n } = useTranslation();
  return (text: string) => showPhrase(i18n.resolvedLanguage, text);
}

type PoolSearch = {
  view: "list" | "new" | "detail" | "signups" | "saved" | "mine";
  id: string;
  theme: string;
  from: "" | "mine" | "signups" | "saved";
};

export const Route = createFileRoute("/pool")({
  validateSearch: (search: Record<string, unknown>): PoolSearch => ({
    view:
      search.view === "new" ||
      search.view === "detail" ||
      search.view === "signups" ||
      search.view === "saved" ||
      search.view === "mine"
        ? search.view
        : "list",
    id: typeof search.id === "string" ? search.id : "",
    theme: typeof search.theme === "string" ? search.theme : "",
    from: search.from === "mine" || search.from === "signups" || search.from === "saved" ? search.from : "",
  }),
  component: WishPoolPage,
  head: () => ({
    meta: [{ title: "nightlong" }],
  }),
});

const HEADCOUNTS: ElderHeadcount[] = ["就我加一位", "3到5人", "不限"];
const PACES: ElderPace[] = ["轻松", "一般"];
const COSTS: ElderCost[] = ["免费", "AA", "各自付费"];

function WishPoolPage() {
  const show = useShowZh();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, hydrated } = useAuth();
  const qc = useQueryClient();
  useSavedBootstrap();
  const { data: savedRecords = [] } = useSavedWishes();
  const [signupIds, setSignupIds] = useState<string[]>([]);
  useEffect(() => {
    hydrateSignups();
    const sync = () => setSignupIds(listSignups().map((row) => row.intentId));
    sync();
    return subscribeSignups(sync);
  }, []);
  const savedIds = savedRecords.map((row) => row.intentId);
  const { data: myIntents = [] } = useMyIntents(Boolean(user));
  useEffect(() => {
    if (!hydrated || user || search.view !== "mine") return;
    void navigate({ to: "/auth", search: { mode: "signin", redirect: "/pool?view=mine" } });
  }, [hydrated, user, search.view, navigate]);
  const pool = useQuery({
    queryKey: ["wish-pool"],
    queryFn: async () => {
      const demo = elderDemoIntents();
      try {
        const rows = await listSeedIntentsFn();
        const byId = new Map<string, Intent>();
        for (const row of [...demo, ...rows, ...loadMyIntents()]) byId.set(row.id, row);
        return [...byId.values()];
      } catch {
        return [...demo, ...loadMyIntents()];
      }
    },
  });

  const items = useMemo(() => {
    const base = pool.data ?? elderDemoIntents();
    const byId = new Map(base.map((item) => [item.id, item]));
    for (const mine of myIntents) byId.set(mine.id, mine);
    return [...byId.values()];
  }, [pool.data, myIntents]);
  const selected = items.find((item) => item.id === search.id) ?? null;

  function joinWish(id: string) {
    if (!user) {
      void navigate({ to: "/auth", search: { mode: "signup", redirect: "/pool" } });
      return;
    }
    toggleSignup(id);
  }

  function openList(theme = search.theme) {
    void navigate({ to: "/pool", search: { view: "list", id: "", theme, from: "" } });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground pb-tabbar">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (search.view === "detail") {
                const back =
                  search.from === "mine" || search.from === "signups" || search.from === "saved"
                    ? search.from
                    : "list";
                void navigate({
                  to: "/pool",
                  search: { view: back, id: "", theme: back === "list" ? search.theme : "", from: "" },
                });
                return;
              }
              if (
                search.view === "list" ||
                search.view === "signups" ||
                search.view === "saved" ||
                search.view === "mine"
              ) {
                void navigate({ to: "/" });
                return;
              }
              openList();
            }}
            className="inline-flex items-center gap-1 text-[18px]"
          >
            <ArrowLeft className="w-5 h-5" />
            {show("返回")}
          </button>
          <h1 className="text-[22px] font-semibold">
            {show(
              search.view === "new"
                ? "发心愿"
                : search.view === "detail"
                  ? "心愿详情"
                  : search.view === "signups"
                    ? "我的报名"
                    : search.view === "saved"
                      ? "我的收藏"
                      : search.view === "mine"
                        ? "我发的心愿"
                        : "逛心愿池",
            )}
          </h1>
          <span className="ml-auto">
            <AccountMenu />
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {search.view === "new" ? (
          <PublishForm
            signedIn={Boolean(user)}
            onNeedAuth={() => void navigate({ to: "/auth", search: { mode: "signin", redirect: "/pool" } })}
            onPublished={(intent) => {
              qc.setQueryData<Intent[]>(["wish-pool"], (prev) => [intent, ...(prev ?? items)]);
              void navigate({ to: "/pool", search: { view: "detail", id: intent.id, theme: "", from: "mine" } });
            }}
          />
        ) : search.view === "detail" && selected ? (
          <WishDetail
            intent={selected}
            signed={signupIds.includes(selected.id)}
            saved={savedIds.includes(selected.id)}
            own={selected.ownerId === "me"}
            onSignup={() => joinWish(selected.id)}
            onSave={() => {
              if (!user) {
                void navigate({ to: "/auth", search: { mode: "signin", redirect: "/pool" } });
                return;
              }
              toggleSaved(selected.id, "");
            }}
          />
        ) : search.view === "signups" || search.view === "saved" || search.view === "mine" ? (
          <WishList
            items={
              search.view === "mine"
                ? items.filter((item) => item.ownerId === "me")
                : items.filter((item) =>
                    (search.view === "signups" ? signupIds : savedIds).includes(item.id),
                  )
            }
            theme=""
            signupIds={signupIds}
            savedIds={savedIds}
            showActions={search.view !== "mine"}
            emptyText={show(
              search.view === "mine"
                ? "还没有发布的心愿。"
                : search.view === "signups"
                  ? "还没有报名的活动。"
                  : "还没有收藏的活动。",
            )}
            onTheme={() => undefined}
            onOpen={(id) =>
              void navigate({
                to: "/pool",
                search: {
                  view: "detail",
                  id,
                  theme: "",
                  from: search.view === "mine" || search.view === "signups" || search.view === "saved" ? search.view : "",
                },
              })
            }
            onSignup={(id) => joinWish(id)}
            onSave={(id) => {
              if (!user) {
                void navigate({ to: "/auth", search: { mode: "signin", redirect: "/pool" } });
                return;
              }
              toggleSaved(id, "");
            }}
          />
        ) : (
          <WishList
            items={items.filter(isElderPoolIntent)}
            theme={search.theme}
            signupIds={signupIds}
            savedIds={savedIds}
            onTheme={(theme) => openList(theme)}
            onOpen={(id) => void navigate({ to: "/pool", search: { view: "detail", id, theme: search.theme, from: "" } })}
            onSignup={(id) => joinWish(id)}
            onSave={(id) => {
              if (!user) {
                void navigate({ to: "/auth", search: { mode: "signin", redirect: "/pool" } });
                return;
              }
              toggleSaved(id, "");
            }}
            onPublish={() => {
              if (!user) {
                void navigate({ to: "/auth", search: { mode: "signin", redirect: "/pool" } });
                return;
              }
              void navigate({ to: "/pool", search: { view: "new", id: "", theme: "", from: "" } });
            }}
          />
        )}
      </main>
    </div>
  );
}

function WishList({
  items,
  theme,
  signupIds,
  savedIds,
  emptyText,
  showActions = true,
  onTheme,
  onOpen,
  onSignup,
  onSave,
  onPublish,
}: {
  items: Intent[];
  theme: string;
  signupIds: string[];
  savedIds: string[];
  emptyText?: string;
  showActions?: boolean;
  onTheme: (theme: string) => void;
  onOpen: (id: string) => void;
  onSignup: (id: string) => void;
  onSave: (id: string) => void;
  onPublish?: () => void;
}) {
  const show = useShowZh();
  const shown = items
    .filter((item) => !theme || item.elderTheme === theme || item.activityCore === theme)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const showFilters = Boolean(onPublish);

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!theme} label={show("全部")} onClick={() => onTheme("")} />
          {ELDER_THEMES.map((item) => (
            <FilterChip key={item} active={theme === item} label={show(item)} onClick={() => onTheme(item)} />
          ))}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="text-[18px] text-muted-foreground py-8 text-center">
          {emptyText ?? show("这个主题下还没有心愿。")}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((intent) => (
            <li key={intent.id} className="rounded-2xl border border-border bg-card px-4 py-4">
              <button type="button" onClick={() => onOpen(intent.id)} className="w-full text-left">
                <div className="flex items-center gap-2 text-[16px] text-primary">
                  <span>{show(intent.elderTheme || intent.activityCore || "组局")}</span>
                  <span className="text-muted-foreground">{show(intent.whenLabel || "")}</span>
                </div>
                <p className="mt-1 text-[20px] font-medium leading-snug">
                  {show(intent.rawText_zh || intent.rawText)}
                </p>
                <p className="mt-2 text-[16px] text-muted-foreground">
                  {show(intent.ownerName_zh || intent.ownerName)}
                  {intent.placeRaw || intent.venue_zh ? ` · ${show(intent.placeRaw || intent.venue_zh || "")}` : ""}
                  {intent.headcount ? ` · ${show(intent.headcount)}` : ""}
                  {intent.pace ? ` · ${show(intent.pace)}` : ""}
                  {intent.cost ? ` · ${show(intent.cost)}` : ""}
                </p>
              </button>
              {showActions ? (
                <ActivityActions
                  signed={signupIds.includes(intent.id)}
                  saved={savedIds.includes(intent.id)}
                  onSignup={() => onSignup(intent.id)}
                  onSave={() => onSave(intent.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityActions({
  signed,
  saved,
  onSignup,
  onSave,
}: {
  signed: boolean;
  saved: boolean;
  onSignup: () => void;
  onSave: () => void;
}) {
  const show = useShowZh();
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onSignup}
        className={[
          "rounded-xl py-3 text-[18px] font-medium",
          signed ? "bg-primary text-primary-foreground" : "border border-border bg-background",
        ].join(" ")}
      >
        {show(signed ? "已报名" : "报名")}
      </button>
      <button
        type="button"
        onClick={onSave}
        className={[
          "rounded-xl py-3 text-[18px] font-medium",
          saved ? "bg-primary text-primary-foreground" : "border border-border bg-background",
        ].join(" ")}
      >
        {show(saved ? "已收藏" : "收藏")}
      </button>
    </div>
  );
}

function WishDetail({
  intent,
  signed,
  saved,
  own,
  onSignup,
  onSave,
}: {
  intent: Intent;
  signed: boolean;
  saved: boolean;
  own?: boolean;
  onSignup: () => void;
  onSave: () => void;
}) {
  const show = useShowZh();
  const spoken = [
    intent.rawText_zh || intent.rawText,
    intent.placeRaw ? `地点${intent.placeRaw}` : "",
    intent.headcount ? `希望${intent.headcount}` : "",
    intent.pace ? `节奏${intent.pace}` : "",
    intent.cost ? `费用${intent.cost}` : "",
    intent.otherReqRaw || "",
  ]
    .filter(Boolean)
    .join("。");

  return (
    <article className="rounded-2xl border border-border bg-card px-5 py-5 space-y-3">
      <p className="text-[16px] text-primary">{show(intent.elderTheme || "组局")}</p>
      <h2 className="text-[26px] font-semibold leading-snug">{show(intent.rawText_zh || intent.rawText)}</h2>
      <dl className="space-y-3 text-[18px]">
        {(
          [
            ["发起人", intent.ownerName_zh || intent.ownerName],
            ["时间", intent.whenLabel || "时间灵活"],
            ["地点", intent.placeRaw || intent.venue_zh || intent.city_zh || "香港"],
            ["人数", intent.headcount || "不限"],
            ["节奏", intent.pace || "轻松"],
            ["费用", intent.cost || "未写"],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{show(label)}</dt>
            <dd className="text-[22px] leading-snug">{show(value)}</dd>
          </div>
        ))}
      </dl>
      {intent.otherReqRaw ? <p className="text-[18px] leading-relaxed">{show(intent.otherReqRaw)}</p> : null}
      {own ? null : <ActivityActions signed={signed} saved={saved} onSignup={onSignup} onSave={onSave} />}
      <CantoneseListenButton text={show(spoken)} />
    </article>
  );
}

function PublishForm({
  signedIn,
  onNeedAuth,
  onPublished,
}: {
  signedIn: boolean;
  onNeedAuth: () => void;
  onPublished: (intent: Intent) => void;
}) {
  const show = useShowZh();
  const [activity, setActivity] = useState("");
  const [activityMissing, setActivityMissing] = useState(false);
  const [whenLabel, setWhenLabel] = useState("周六上午");
  const [place, setPlace] = useState("");
  const [headcount, setHeadcount] = useState<ElderHeadcount>("3到5人");
  const [pace, setPace] = useState<ElderPace>("轻松");
  const [cost, setCost] = useState<ElderCost>("AA");
  const [note, setNote] = useState("");

  const what = activity.trim();
  const preview = useMemo(() => {
    const where = place.trim() || "香港";
    const doing = what || "……";
    return `${whenLabel}想约人${doing}，地点在${where}，希望${headcount}。节奏${pace}，费用${cost}。${note.trim()}`;
  }, [what, whenLabel, place, headcount, pace, cost, note]);

  function publish() {
    if (!signedIn) {
      onNeedAuth();
      return;
    }
    if (!what) {
      setActivityMissing(true);
      return;
    }
    const intent = publishMyIntent({
      kind: "other",
      activityCore: what,
      rawText: preview,
      city: "Hong Kong",
      city_zh: "香港",
      placeRaw: place.trim() || "香港",
      placeMode: "offline",
      place: { city: "hong_kong" },
      activityStrength: "flex",
      placeStrength: "flex",
      elderTheme: what,
      headcount,
      pace,
      cost,
      whenLabel,
      otherReqRaw: note.trim(),
    });
    onPublished(intent);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        publish();
      }}
    >
      <Field label={show("想做什么")}>
        <input
          value={activity}
          onChange={(e) => {
            setActivity(e.target.value);
            if (e.target.value.trim()) setActivityMissing(false);
          }}
          className="elder-input"
          placeholder={show("自己写，比如逛公园看花")}
        />
        <CantoneseMicButton
          onText={(text) => {
            setActivity((prev) => (prev ? `${prev}${text}` : text));
            if (text.trim()) setActivityMissing(false);
          }}
        />
        {activityMissing ? (
          <p className="text-[16px] text-destructive">{show("先写下想做什么。")}</p>
        ) : null}
      </Field>
      <Field label={show("什么时候")}>
        <input
          value={whenLabel}
          onChange={(e) => setWhenLabel(e.target.value)}
          className="elder-input"
          placeholder={show("例如：周六上午")}
        />
      </Field>
      <Field label={show("在哪里")}>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className="elder-input"
          placeholder={show("例如：九龙公园")}
        />
      </Field>
      <Field label={show("希望几个人")}>
        <div className="flex flex-wrap gap-2">
          {HEADCOUNTS.map((item) => (
            <FilterChip key={item} active={headcount === item} label={show(item)} onClick={() => setHeadcount(item)} />
          ))}
        </div>
      </Field>
      <Field label={show("节奏")}>
        <div className="flex flex-wrap gap-2">
          {PACES.map((item) => (
            <FilterChip key={item} active={pace === item} label={show(item)} onClick={() => setPace(item)} />
          ))}
        </div>
      </Field>
      <Field label={show("费用")}>
        <div className="flex flex-wrap gap-2">
          {COSTS.map((item) => (
            <FilterChip key={item} active={cost === item} label={show(item)} onClick={() => setCost(item)} />
          ))}
        </div>
      </Field>
      <Field label={show("备注")}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="elder-input"
          placeholder={show("还有什么想说的")}
        />
        <CantoneseMicButton onText={(text) => setNote((prev) => (prev ? `${prev}${text}` : text))} />
      </Field>
      <p className="text-[18px] leading-relaxed text-muted-foreground">
        {show(whenLabel)}
        {" · "}
        {what || show("想做什么")}
        {" · "}
        {place.trim() || show("香港")}
        {" · "}
        {show(headcount)}
        {" · "}
        {show(pace)}
        {" · "}
        {show(cost)}
        {note.trim() ? ` · ${note.trim()}` : ""}
      </p>
      <button type="submit" className="w-full rounded-2xl bg-primary text-primary-foreground text-[20px] font-medium py-4">
        {show("发布到心愿池")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[18px] font-medium">{label}</span>
      {children}
    </label>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-2 text-[18px]",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
