import type { ButtonHTMLAttributes, CSSProperties } from "react";
import "./PushButton.css";

type CssWidth = CSSProperties["width"];

export interface PushButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /**
   * 凹槽（pb__socket）的直径，也就是整个组件占据的大小。
   * 数字按 px 处理，字符串原样使用（如 "3rem"、"calc(2em + 4px)"）。
   * 因为要参与阴影计算，请使用绝对长度，不要传百分比或 auto。
   * @default 120
   */
  diameter?: CssWidth;

  /**
   * 按钮本体（pb__cap）的直径，在凹槽内居中。
   * 规则同 diameter。
   * @default `calc(${diameter} - 3px)`
   */
  capDiameter?: CssWidth;

  /** 已点击：固定显示按下（:active）时的样子。@default false */
  pressed?: boolean;

  /** 是否使用约 150ms 的陷落动画；false 则瞬间切换。@default false */
  pressAnimate?: boolean;
  /** `pressAnimate` 的连字符写法，两者任意一个为 true 即生效 */
  "press-animate"?: boolean;

  /** 按钮面是否为粗糙的塑料颗粒质感；false 则是光滑的渐变。@default false */
  textured?: boolean;
}

/** 数字 → px；字符串原样返回 */
const toCssLength = (value: CssWidth): string | undefined =>
  typeof value === "number" ? `${value}px` : value;

export default function PushButton({
  diameter = 120,
  capDiameter,
  pressed = false,
  pressAnimate,
  "press-animate": pressAnimateAttr,
  textured = false,
  className,
  style,
  type = "button",
  ...rest
}: PushButtonProps) {
  const socketSize = toCssLength(diameter);
  const capSize = toCssLength(capDiameter) ?? `calc(${socketSize} - 3px)`;
  const animate = Boolean(pressAnimate || pressAnimateAttr);

  const classes = [
    "pb",
    pressed && "pb--pressed",
    animate && "pb--animate",
    textured && "pb--textured",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      style={
        {
          "--pb-d": socketSize,
          "--pb-cap-d": capSize,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      <span className="pb__socket" aria-hidden="true" />
      <span className="pb__cap" aria-hidden="true" />
    </button>
  );
}
