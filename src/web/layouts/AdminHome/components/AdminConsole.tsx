import React, { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/utils/cn'
import { LedIndicator } from './LedIndicator';
import SegmentLCDProgress from './SegmentLCDProgress';
import MemberPopover from './MemberPopover';
import styles from './AdminConsole.module.css';

/* ============================== 类型 ============================== */

export interface AdminStats {
  photos: number;
  albums: number;
  votes: number;
  members: number;
}

export interface AdminSettings {
  avatarThumbSize: number;
  photoThumbSize: number;
  maxImageSize: number;
  maxUploadMB: number;
  thumbQuality: number; // 1~100
  avifQuality: number; // 1~100
  avifEffort: number; // 0~9
}

export interface Member {
  id: string | number;
  nickname: string;
  qq: string;
  avatarUrl?: string;
}

export interface RebuildReporter {
  /** 汇报进度：已处理数量 / 总数量。数码管显示的是“剩余项目” = total - done */
  progress: (done: number, total: number) => void;
  /** 打印一行错误。只有出错时才会调用 */
  error: (message: string) => void;
}

export type MemberCanDelete = (member: Member) => boolean;

export interface AdminConsoleProps {
  stats: AdminStats;
  settings: AdminSettings;
  onSettingsChange: (next: AdminSettings) => void;
  members: Member[];
  memberCanDelete?(member: Member): boolean;
  onMembersChanged?(): void | Promise<void>;
  /** 抛出异常会被当作致命错误打印 */
  onRebuild?: (reporter: RebuildReporter) => Promise<void>;
  /** 覆盖发射台右侧便签纸上的默认警告文字（可选） */
  rebuildNote?: ReactNode;
}

/* ============================== 数码管 ============================== */

const SEG: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};

const POLY: Record<string, string> = {
  a: '1.6,0.6 10.4,0.6 9.2,2.6 2.8,2.6',
  b: '11.2,1.6 11.2,9.6 9.4,8.6 9.4,3.4',
  c: '11.2,10.4 11.2,18.4 9.4,16.6 9.4,11.4',
  d: '2.8,17.4 9.2,17.4 10.4,19.4 1.6,19.4',
  e: '0.8,10.4 2.6,11.4 2.6,16.6 0.8,18.4',
  f: '0.8,1.6 2.6,3.4 2.6,8.6 0.8,9.6',
  g: '2.4,10 3.6,8.9 8.4,8.9 9.6,10 8.4,11.1 3.6,11.1',
};

function Digit({ ch }: { ch: string }) {
  const on = SEG[ch] ?? '';
  return (
    <svg viewBox="0 0 12 20" className={styles.digit} aria-hidden>
      {Object.entries(POLY).map(([k, points]) => (
        <polygon key={k} points={points} className={on.includes(k) ? styles.segOn : styles.segOff} />
      ))}
    </svg>
  );
}

const COUNT_MS = 700;

/** 从 0 快速自增到 target。run=false 时复位为 0，下次 run=true 再重新计数 */
function useCountUp(target: number, run: boolean, enabled: boolean) {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) return;
    if (!run) { setV(0); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_MS);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); // easeOutCubic：先快后慢
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, enabled]);
  return enabled ? v : target;
}

interface LcdNumberProps {
  value: number;
  digits?: number;
  height?: number | string;
  /** 是否从 0 自增到 value（用于数据面板） */
  countUp?: boolean;
  /** countUp 的触发开关：面板可见时为 true */
  run?: boolean;
}

/** 单色液晶数码管：未点亮的笔画保留淡淡的“鬼影” */
export function LcdNumber({ value, digits = 6, height = 44, countUp = false, run = true }: LcdNumberProps) {
  const shown = useCountUp(value, run, countUp);
  const raw = String(Math.max(0, Math.floor(shown)));
  const text = (raw.length > digits ? '9'.repeat(digits) : raw).padStart(digits, ' ');
  const dh = typeof height === 'number' ? `${height}px` : height;
  return (
    <div className={styles.lcd} role="img" aria-label={String(value)}>
      <div className={styles.digits} style={{ '--dh': dh } as CSSProperties}>
        {text.split('').map((ch, i) => (
          <Digit key={i} ch={ch} />
        ))}
      </div>
    </div>
  );
}

/* ============================== 面板 A：数据 ============================== */

const ICONS: Record<string, ReactNode> = {
  photo: (<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M3 17l5-4 4 3 3-2 6 4" /></>),
  album: (<><rect x="7" y="3" width="14" height="14" rx="2" /><path d="M3 7v12a2 2 0 002 2h12" /></>),
  vote: (<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12l3 3 5-6" /></>),
  progress: (<><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M6 12h7" strokeWidth="3" /></>),
  queue: (<><path d="M4 6h16M4 12h16M4 18h10" /></>),
  member: (<><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.6-4 3.8-6 7.5-6s6.9 2 7.5 6" /></>),
};

function StatsPanel({ stats, active }: { stats: AdminStats; active: boolean }) {
  const tiles = [
    { icon: 'photo', label: '相片总数', value: stats.photos },
    { icon: 'album', label: '相册总数', value: stats.albums },
    { icon: 'vote', label: '投票总数', value: stats.votes },
    { icon: 'member', label: '成员总数', value: stats.members },
  ];
  return (
    <div className={styles.stats}>
      {tiles.map((t) => (
        <section key={t.label}>
          <div className={styles.tileHead}>
            <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>{ICONS[t.icon]}</svg>
            {t.label}
          </div>
          <LcdNumber value={t.value} digits={8} height="var(--stat-dh)" countUp run={active} />
        </section>
      ))}
    </div>
  );
}

/* ============================== 面板 B：设置 ============================== */

interface NumFieldDef {
  key: 'avatarThumbSize' | 'photoThumbSize' | 'maxImageSize' | 'maxUploadMB';
  label: string;
  unit: string;
  min: number;
  max: number;
}

const NUM_FIELDS: NumFieldDef[] = [
  { key: 'avatarThumbSize', label: '头像缩略图尺寸', unit: 'px', min: 16, max: 1024 },
  { key: 'photoThumbSize', label: '相片缩略图尺寸', unit: 'px', min: 64, max: 4096 },
  { key: 'maxImageSize', label: '最大图片尺寸', unit: 'px', min: 256, max: 16384 },
  { key: 'maxUploadMB', label: '最大上传大小', unit: 'MB', min: 1, max: 1024 },
];

/** 输入过程中允许任意草稿，失焦或回车时才校正到范围内 */
function NumField({ def, value, onCommit }: { def: NumFieldDef; value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Math.round(Number(draft));
    onCommit(Number.isFinite(n) && draft.trim() !== '' ? Math.min(def.max, Math.max(def.min, n)) : value);
    setDraft(null);
  };
  return (
    <label className={styles.row}>
      {def.label}
      <span className={styles.fieldWrap}>
        <input
          className={styles.field}
          type="number"
          inputMode="numeric"
          min={def.min}
          max={def.max}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <span className={styles.unit}>{def.unit}</span>
      </span>
    </label>
  );
}

const SLIDERS = [
  { key: 'thumbQuality', label: '缩略图质量', min: 1, max: 100 },
  { key: 'avifQuality', label: '全尺寸 AVIF 质量', min: 1, max: 100 },
  { key: 'avifEffort', label: '图像转换 effort', min: 0, max: 9 },
] as const;

function SettingsPanel({ settings, onChange }: { settings: AdminSettings; onChange: (s: AdminSettings) => void }) {
  return (
    <div className={styles.settings}>
      <div className={styles.group}>
        {NUM_FIELDS.map((def) => (
          <NumField key={def.key} def={def} value={settings[def.key]} onCommit={(n) => onChange({ ...settings, [def.key]: n })} />
        ))}
      </div>
      <div className={styles.group}>
        {SLIDERS.map((def) => (
          <div key={def.key} className={styles.sliderRow}>
            <label htmlFor={`slider-${def.key}`}>{def.label}</label>
            <LcdNumber value={settings[def.key]} digits={3} height={22} />
            <input
              id={`slider-${def.key}`}
              className={styles.range}
              type="range"
              min={def.min}
              max={def.max}
              step={1}
              value={settings[def.key]}
              onChange={(e) => onChange({ ...settings, [def.key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== 面板 C：缩略图重建 ============================== */

interface LogLine {
  id: number;
  time: string;
  text: string;
}

const MAX_LINES = 60;

/** 发射台：先点玻璃盖开盖（保险灯 → 待发灯），再点红色按钮才会真正触发 */
function LaunchSwitch({ armed, running, onToggleCover, onFire }: {
  armed: boolean; running: boolean; onToggleCover: () => void; onFire: () => void;
}) {
  return (
    <div className={styles.launch}>
      <div className={styles.housing}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={cn(styles.screw, styles[`screw${i}`])} />
        ))}
        <p className={styles.nameplate}>缩略图重建</p>
        <div className={styles.hazard} />
        <div className={styles.lamps}>
          <LedIndicator color={!armed && !running ? 'green' : null} label="保险" />
          <LedIndicator color={armed || running ? 'red' : null} label="待发" />
        </div>
        <div className={styles.stage}>
          <div className={cn(styles.well, (armed || running) && styles.armed)}>
            <button
              type="button"
              className={cn(styles.fire, running && styles.firing)}
              disabled={!armed || running}
              tabIndex={armed ? 0 : -1}
              aria-label="开始重建缩略图"
              onClick={onFire}
            />
          </div>
          <div className={styles.hingeBar} />
          <button
            type="button"
            className={cn(styles.cover, armed && styles.coverOpen)}
            disabled={running}
            aria-pressed={armed}
            aria-label={armed ? '盖上保护盖' : '打开保护盖'}
            onClick={onToggleCover}
          />
        </div>
      </div>
    </div>
  );
}

/** 热敏纸：最新一行贴着槽口，旧的往下排；每一节都比上一节再向外弯一点（见 CSS 的 .seg） */
const PAPER_LINES = 14;

function Paper({ lines }: { lines: LogLine[] }) {
  const shown = [...lines].reverse().slice(0, PAPER_LINES);
  const newestId = shown[0]?.id;
  const render = (i: number): ReactNode => {
    const l = shown[i];
    if (!l) return null;
    return (
      <div className={styles.seg}>
        <p
          key={l.id}
          className={cn(
            styles.line,
            i === 0 && styles.lineFirst,
            i === shown.length - 1 && styles.lineLast,
            l.id === newestId && styles.feeding, // 只有最新的一行播放走纸动画
          )}
        >
          <span className={styles.feedClip}>
            <span className={styles.lineText}>{l.time} {l.text}</span>
          </span>
        </p>
        {render(i + 1)}
      </div>
    );
  };
  return (
    <div className={styles.paper} role="log" aria-live="polite">
      {render(0)}
    </div>
  );
}

function RebuildPanel({ onRebuild, note }: { onRebuild?: AdminConsoleProps['onRebuild']; note?: ReactNode }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [armed, setArmed] = useState(false);
  const [count, setCount] = useState({ done: 0, total: 0 });
  const [lines, setLines] = useState<LogLine[]>([]);
  const seq = useRef(0);

  const print = (text: string) =>
    setLines((prev) => [...prev, { id: ++seq.current, time: new Date().toTimeString().slice(0, 8), text }].slice(-MAX_LINES));

  const fire = async () => {
    if (!armed || phase === 'running') return;
    setPhase('running');
    setCount({ done: 0, total: 0 });
    setLines([]);
    try {
      await onRebuild?.({ progress: (done, total) => setCount({ done, total }), error: print });
      setCount((c) => ({ done: c.total, total: c.total }));
    } catch (e) {
      print(`FATAL ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPhase('done');
      setArmed(false); // 完成后自动盖回保护盖，防止误触
    }
  };

  const hasError = lines.length > 0;
  const clear = () => setLines([]);
  const remaining = Math.max(0, count.total - count.done);
  const percent = count.total > 0 ? (count.done / count.total) * 100 : phase === 'done' && !hasError ? 100 : 0;

  return (
    <div className={styles.rebuild}>
      <div className={styles.rebuildTop}>
        <LaunchSwitch armed={armed} running={phase === 'running'} onToggleCover={() => setArmed((a) => !a)} onFire={fire} />
        <div className={styles.side}>
          <div className={styles.note}>
            {['TL', 'BR'].map((k) => (
              <i key={k} className={cn(styles.tape, styles[`tape${k}`])} aria-hidden />
            ))}
            {note ?? (<><b>注意：</b>重建缩略图很慢，而且可能导致程序崩溃。重建期间请不要关闭浏览器窗口。</>)}
          </div>
          <div className={styles.readout}>
            <section>
              <div className={styles.tileHead}>
                <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>{ICONS.queue}</svg>
                剩余项目
              </div>
              <LcdNumber value={remaining} digits={8} height="var(--stat-dh)" />
            </section>
            <div className={styles.leds}>
              <LedIndicator color={phase === 'running' ? 'blue' : null} label="运行" />
              <LedIndicator color={phase === 'done' && !hasError ? 'green' : null} label="完成" />
              <LedIndicator color={hasError ? 'red' : null} label="出错" />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bar}>
        <div className={styles.tileHead}>
          <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden>{ICONS.progress}</svg>
          重建进度
        </div>
        <SegmentLCDProgress
          progress={percent}
          height={24}
          showFrame={false}
          frameThickness={0}
          screenPadding={4}
        />
      </div>

      {/* 打印槽：与整列等宽。平时只是一条缝，出错才吐纸；新的一行在最上面，把旧的往下推 */}
      <div className={styles.printer}>
        <div className={styles.slot} />
        {hasError && (
          <>
            <button type="button" className={styles.tear} onClick={clear}>撕下</button>
            <Paper lines={lines} />
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== 面板 D：名单簿 ============================== */

function MemberPanel({ members, onMembersChanged, memberCanDelete }: { members: Member[]; onMembersChanged?: () => void | Promise<void>; memberCanDelete?: MemberCanDelete }) {
  // 仅大屏生效：默认收起，点击标题条展开。小屏由单选按钮切换，这里的状态被 CSS 忽略
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(open && styles.memberOpen)}>
      <button
        type="button"
        className={styles.memberToggle}
        aria-expanded={open}
        aria-controls="member-body"
        onClick={() => setOpen((o) => !o)}
      >
        <span>成员</span>
        <span className={styles.bookCount}>共 {members.length} 人</span>
      </button>
      <div id="member-body" className={styles.memberBody}>
        <div className={styles.book}>
          <div className={styles.bookHead}>
            <span className={styles.bookTitle}>名单簿</span>
            <div className={styles.bookHeadActions}>
              <span className={styles.bookCount}>共 {members.length} 人</span>
              <MemberPopover
                mode='create'
                trigger={(
                  <button type='button' className={styles.addMember}>
                    新增成员
                  </button>
                )}
                onSaved={onMembersChanged ?? (() => {})}
              />
            </div>
          </div>
          <div className={styles.bookScroll}>
            {members.length === 0 && <div className={styles.empty}>还没有成员。</div>}
            <div className={styles.memberList}>
              {members.map((m) => {
                const hue = Number(m.qq.replace(/\D/g, '')) % 360 || 0; // 没有头像时，用 QQ 号算一个稳定的底色
                return (
                  <MemberPopover
                    key={m.id}
                    mode='edit'
                    member={m}
                    canDelete={memberCanDelete?.(m) ?? false}
                    trigger={(
                      <button type='button' className={styles.member} aria-label={`修改成员 ${m.nickname}`}>
                        {m.avatarUrl ? (
                          <img className={styles.avatar} src={m.avatarUrl} alt="" loading="lazy" />
                        ) : (
                          <span className={styles.avatar} style={{ background: `hsl(${hue} 40% 82%)`, color: `hsl(${hue} 35% 28%)` }}>
                            {m.nickname.slice(0, 1)}
                          </span>
                        )}
                        <div className={styles.who}>
                          <span className={styles.nick}>{m.nickname}</span>
                          <span className={styles.qq}><small>QQ</small>{m.qq}</span>
                        </div>
                      </button>
                    )}
                    onSaved={onMembersChanged ?? (() => {})}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== 主控制台 ============================== */

const TABS = [
  { id: 'stats', label: '数据' },
  { id: 'settings', label: '设置' },
  { id: 'rebuild', label: '缩略图' },
  { id: 'members', label: '成员' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function useIsLarge() {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 641px)');
    const sync = () => setLarge(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return large;
}

export function AdminConsole({ stats, settings, onSettingsChange, members, memberCanDelete, onMembersChanged, onRebuild, rebuildNote }: AdminConsoleProps) {
  const [tab, setTab] = useState<TabId>('stats');
  const isLarge = useIsLarge(); // 大屏时所有面板都可见
  const keyRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    keyRefs.current[next]?.focus();
  };

  // 所有面板常驻挂载。小屏用 .off 隐藏，大屏全部平铺；重建进行中切走再切回来，状态不会丢
  return (
    <div className={styles.root}>
      <div className={styles.bank} role="radiogroup" aria-label="面板" onKeyDown={onKeyDown}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { keyRefs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={t.id === tab}
            aria-controls={`panel-${t.id}`}
            tabIndex={t.id === tab ? 0 : -1}
            className={styles.key}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.console}>
        <div className={styles.inner}>
        <div id="panel-stats" className={cn(styles.panel, styles.pStats, tab !== 'stats' && styles.off)}>
          <StatsPanel stats={stats} active={isLarge || tab === 'stats'} />
        </div>
        <div id="panel-settings" className={cn(styles.panel, styles.pSettings, tab !== 'settings' && styles.off)}>
          <SettingsPanel settings={settings} onChange={onSettingsChange} />
        </div>
        <div id="panel-rebuild" className={cn(styles.panel, styles.pRebuild, tab !== 'rebuild' && styles.off)}>
          <RebuildPanel onRebuild={onRebuild} note={rebuildNote} />
        </div>
        <div id="panel-members" className={cn(styles.panel, styles.pMembers, tab !== 'members' && styles.off)}>
          <MemberPanel members={members} memberCanDelete={memberCanDelete} onMembersChanged={onMembersChanged} />
        </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== 演示（可删除） ============================== */

export function AdminConsoleDemo() {
  const [settings, setSettings] = useState<AdminSettings>({
    avatarThumbSize: 128, photoThumbSize: 480, maxImageSize: 4096, maxUploadMB: 50,
    thumbQuality: 80, avifQuality: 60, avifEffort: 4,
  });
  const members: Member[] = [
    { id: 1, nickname: '444', qq: '10001' },
    { id: 2, nickname: '111', qq: '10002' },
    { id: 3, nickname: '321', qq: '10003' },
    { id: 4, nickname: '666', qq: '10004' },
  ];
  const fakeRebuild = async (r: RebuildReporter) => {
    for (let i = 1; i <= 20; i++) {
      await new Promise((ok) => setTimeout(ok, 120));
      r.progress(i, 20);
      if (i === 7) r.error('E 0412.jpg  decode failed: bad EXIF');
      if (i === 13) r.error('E 0977.png  out of memory (16384x16384)');
    }
  };
  return (
    <AdminConsole
      stats={{ photos: 1284, albums: 36, votes: 5207, members: 4 }}
      settings={settings}
      onSettingsChange={setSettings}
      members={members}
      onRebuild={fakeRebuild}
    />
  );
}
