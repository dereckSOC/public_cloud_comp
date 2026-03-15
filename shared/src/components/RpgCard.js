"use client";
import Image from "next/image";

const CARD_SHADOW = "0 10px 50px rgba(0,0,0,0.9), inset 0 0 100px rgba(0,0,0,0.1)";

function getOuterCardThemeClass(variant) {
  if (variant === "question") return "bg-transparent border-0 shadow-none";
  if (variant === "dialogue1") {
    return [
      "bg-purple-900/10 border-purple-500/60",
      "hover:bg-gradient-to-b hover:from-purple-300 hover:via-purple-200 hover:to-purple-300",
      "hover:border-purple-900",
      "active:bg-gradient-to-b active:from-purple-300 active:via-purple-200 active:to-purple-300",
      "active:border-purple-900",
    ].join(" ");
  }
  if (variant === "dialogue2") {
    return [
      "bg-green-900/10 border-green-500/60",
      "hover:bg-gradient-to-b hover:from-green-200 hover:via-green-100 hover:to-green-200",
      "hover:border-green-900",
      "active:bg-gradient-to-b active:from-green-200 active:via-green-100 active:to-green-200",
      "active:border-green-900",
    ].join(" ");
  }
  if (variant === "blue") {
    return "bg-gradient-to-b from-blue-300 via-blue-200 to-blue-300 border-blue-900";
  }
  return "bg-gradient-to-b from-stone-200 via-stone-100 to-stone-200 border-stone-900";
}

function getInnerCardThemeClass(variant) {
  if (variant === "question") return "m-0 rounded-3xl";
  if (variant === "dialogue1") {
    return [
      "m-2 border-2 border-purple-400 bg-white",
      "hover:border-purple-800",
      "active:border-purple-800",
    ].join(" ");
  }
  if (variant === "dialogue2") {
    return [
      "m-2 border-2 border-green-400 bg-white",
      "hover:border-green-800",
      "active:border-green-800",
    ].join(" ");
  }
  if (variant === "blue") {
    return "m-2 border-2 border-blue-800 bg-white";
  }
  return "m-2 border-2 border-stone-800 bg-stone-100";
}

function getCornerClipColor(variant) {
  if (variant === "question") return "border-transparent";
  if (variant === "dialogue1") return "border-purple-700";
  if (variant === "dialogue2") return "border-green-700";
  if (variant === "blue") return "border-blue-700";
  return "border-stone-700";
}

export default function RpgCard({
  variant = "default",
  children,
  onClick,
  isSelected = false,
  className = "",
  showSpeechTail = false,
  cornerClipSize = "w-6 h-6",
  innerPadding = "p-5",
  style = {},
  noWrapper = false,
}) {
  const outerThemeClass = getOuterCardThemeClass(variant);
  const innerThemeClass = getInnerCardThemeClass(variant);
  const cornerColor = getCornerClipColor(variant);
  const isQuestion = variant === "question";
  const isSelectable = onClick !== undefined;

  const CardTag = isSelectable ? "button" : "div";

  const cardElement = (
    <CardTag
      type={isSelectable ? "button" : undefined}
      className={`${noWrapper ? "" : "flex-1 "}relative ${outerThemeClass} ${
        !isQuestion ? "border-4 rounded-sm shadow-2xl" : ""
      } ${
        isSelectable
          ? "block w-full cursor-pointer touch-manipulation text-left transition-transform hover:scale-[1.01] active:translate-y-0.5 active:shadow-xl"
          : ""
      } ${isSelected ? "ring-4 ring-yellow-300" : ""} ${className}`}
      style={{
        boxShadow: isQuestion ? "none" : CARD_SHADOW,
        ...style,
      }}
      onClick={onClick}
    >
      {!isQuestion && (
        <>
          <div className={`absolute top-1 left-1 ${cornerClipSize} border-t-4 border-l-4 ${cornerColor}`} />
          <div className={`absolute top-1 right-1 ${cornerClipSize} border-t-4 border-r-4 ${cornerColor}`} />
          <div className={`absolute bottom-1 left-1 ${cornerClipSize} border-b-4 border-l-4 ${cornerColor}`} />
          <div className={`absolute bottom-1 right-1 ${cornerClipSize} border-b-4 border-r-4 ${cornerColor}`} />
        </>
      )}

      <div className={`relative bg-white ${innerThemeClass} ${innerPadding}`}>
        {showSpeechTail && (
          <div className="absolute -top-4 right-8 w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-b-[16px] border-b-white" />
        )}
        {children}
      </div>
    </CardTag>
  );

  if (noWrapper) {
    return cardElement;
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {cardElement}
    </div>
  );
}
