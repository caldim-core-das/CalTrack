"use client";
import React, { useEffect, useRef } from "react";
import { ChronicleButton } from "./chronicle-button";

const BAUHAUS_CARD_STYLES = `
.bauhaus-card {
  position: relative;
  z-index: 5;
  max-width: 20rem;
  min-height: 22rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  border-radius: var(--card-radius, 24px);
  border: 1px solid var(--card-border, #E2E8F0);
  background: #FFFFFF;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.bauhaus-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.12);
  border-color: var(--card-accent, #156ef6);
}
.bauhaus-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
}
.bauhaus-date {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #94A3B8;
  font-family: var(--font), ui-sans-serif, system-ui, sans-serif !important;
}
.bauhaus-card-body {
  padding: 0 1.5rem 1.5rem;
  flex: 1;
}
.bauhaus-card-body h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0F172A;
  font-family: var(--font-display), "Inter", ui-sans-serif, system-ui, sans-serif !important;
}
.bauhaus-card-body p {
  color: #64748B;
  font-size: 0.875rem;
  line-height: 1.6;
  font-weight: 500;
  font-family: var(--font), ui-sans-serif, system-ui, sans-serif !important;
}
.bauhaus-progress {
  margin-top: 1.25rem;
}
.bauhaus-progress-bar {
  position: relative;
  width: 100%;
  background: #F1F5F9;
  height: 4px;
  display: block;
  border-radius: 99px;
  overflow: hidden;
}
.bauhaus-progress span {
  font-family: var(--font), ui-sans-serif, system-ui, sans-serif !important;
}
.bauhaus-card-footer {
  padding: 1.5rem;
  border-top: 1px solid #F1F5F9;
  background: #F8FAFC;
}
`;

function injectBauhausCardStyles() {
  if (typeof window === "undefined") return;
  if (!document.getElementById("bauhaus-card-styles")) {
    const style = document.createElement("style");
    style.id = "bauhaus-card-styles";
    style.innerHTML = BAUHAUS_CARD_STYLES;
    document.head.appendChild(style);
  }
}

const isRTL = (text) =>
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(text || "");

export const BauhausCard = ({
  id,
  borderRadius = "2.5em",
  backgroundColor = "#151419",
  separatorColor = "#2F2B2A",
  accentColor = "#156ef6",
  borderWidth = "2px",
  topInscription = "Not Set!",
  swapButtons = false,
  mainText = "Not Set!",
  subMainText = "Not Set!",
  progressBarInscription = "Not Set!",
  progress = 0,
  progressValue = "Not Set!",
  filledButtonInscription = "Not Set!",
  outlinedButtonInscription = "Not Set!",
  onFilledButtonClick,
  onOutlinedButtonClick,
  onMoreOptionsClick,
  mirrored = false,
  textColorTop = "#bfc7d5",
  textColorMain = "#f0f0f1",
  textColorSub = "#a0a1b3",
  textColorProgressLabel = "#b4c7e7",
  textColorProgressValue = "#e7e7f7",
  progressBarBackground = "#363636",
  chronicleButtonBg = "#151419",
  chronicleButtonFg = "#fff",
  chronicleButtonHoverFg = "#fff",
}) => {
  const cardRef = useRef(null);

  useEffect(() => {
    injectBauhausCardStyles();
    const card = cardRef.current;
    const handleMouseMove = (e) => {
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const angle = Math.atan2(-x, y);
        card.style.setProperty("--rotation", angle + "rad");
      }
    };
    if (card) {
      card.addEventListener("mousemove", handleMouseMove);
    }
    return () => {
      if (card) {
        card.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, []);

  return (
    <div
      className="bauhaus-card"
      ref={cardRef}
      style={{
        '--card-bg': backgroundColor,
        '--card-border': separatorColor,
        '--card-accent': accentColor,
        '--card-radius': borderRadius,
        '--card-border-width': borderWidth,
        '--card-text-top': textColorTop,
        '--card-text-main': textColorMain,
        '--card-text-sub': textColorSub,
        '--card-text-progress-label': textColorProgressLabel,
        '--card-text-progress-value': textColorProgressValue,
        '--card-separator': separatorColor,
        '--card-progress-bar-bg': progressBarBackground,
      }}
    >
      <div
        style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
        className="bauhaus-card-header"
      >
        <div
          className="bauhaus-date"
          style={{
            transform: mirrored ? 'scaleX(-1)' : 'none',
            direction: isRTL(topInscription) ? 'rtl' : 'ltr',
            color: 'var(--card-text-top)'
          }}
        >
          {topInscription}
        </div>
        <div
          onClick={() => onMoreOptionsClick?.(id)}
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="bauhaus-size6" style={{ color: 'var(--card-text-top)' }}>
            <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      <div className="bauhaus-card-body">
        <h3 style={{ direction: isRTL(mainText) ? 'rtl' : 'ltr', color: 'var(--card-text-main)' }}>{mainText}</h3>
        <p style={{ direction: isRTL(subMainText) ? 'rtl' : 'ltr', color: 'var(--card-text-sub)' }}>{subMainText}</p>
        <div className="bauhaus-progress">
          <span style={{
            direction: isRTL(progressBarInscription) ? 'rtl' : 'ltr',
            textAlign: mirrored ? 'right' : 'left',
            color: 'var(--card-text-progress-label)',
            display: 'block',
            marginBottom: '4px',
            fontSize: '10px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {progressBarInscription}
          </span>
          <div
            style={{ 
              transform: mirrored ? 'scaleX(-1)' : 'none',
              backgroundColor: 'var(--card-progress-bar-bg)'
            }}
            className="bauhaus-progress-bar"
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                backgroundColor: accentColor,
                height: '100%'
              }}
            />
          </div>
          <span style={{
            direction: isRTL(progressValue) ? 'rtl' : 'ltr',
            textAlign: mirrored ? 'left' : 'right',
            color: 'var(--card-text-progress-value)',
            display: 'block',
            marginTop: '4px',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            {progressValue}
          </span>
        </div>
      </div>
      <div className="bauhaus-card-footer">
        <div className="bauhaus-button-container">
          {swapButtons ? (
            <>
              {outlinedButtonInscription && outlinedButtonInscription !== "Not Set!" && (
                <ChronicleButton
                  text={outlinedButtonInscription}
                  outlined={true}
                  width="100%"
                  onClick={() => onOutlinedButtonClick?.(id)}
                  borderRadius="1.25rem"
                  hoverColor={accentColor}
                  customBackground={chronicleButtonBg}
                  customForeground={chronicleButtonFg}
                  hoverForeground={chronicleButtonHoverFg}
                />
              )}
              {filledButtonInscription && filledButtonInscription !== "Not Set!" && (
                <ChronicleButton
                  text={filledButtonInscription}
                  width="100%"
                  onClick={() => onFilledButtonClick?.(id)}
                  borderRadius="1.25rem"
                  hoverColor={accentColor}
                  customBackground={chronicleButtonBg}
                  customForeground={chronicleButtonFg}
                  hoverForeground={chronicleButtonHoverFg}
                />
              )}
            </>
          ) : (
            <>
              {filledButtonInscription && filledButtonInscription !== "Not Set!" && (
                <ChronicleButton
                  text={filledButtonInscription}
                  width="100%"
                  onClick={() => onFilledButtonClick?.(id)}
                  borderRadius="1.25rem"
                  hoverColor={accentColor}
                  customBackground={chronicleButtonBg}
                  customForeground={chronicleButtonFg}
                  hoverForeground={chronicleButtonHoverFg}
                />
              )}
              {outlinedButtonInscription && outlinedButtonInscription !== "Not Set!" && (
                <ChronicleButton
                  text={outlinedButtonInscription}
                  outlined={true}
                  width="100%"
                  onClick={() => onOutlinedButtonClick?.(id)}
                  borderRadius="1.25rem"
                  hoverColor={accentColor}
                  customBackground={chronicleButtonBg}
                  customForeground={chronicleButtonFg}
                  hoverForeground={chronicleButtonHoverFg}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
