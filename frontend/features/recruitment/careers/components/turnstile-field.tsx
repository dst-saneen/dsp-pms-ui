"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";

interface TurnstileFieldProps {
  onTokenChange?: (token: string | null) => void;
}

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileField({ onTokenChange }: TurnstileFieldProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const allowMockSimulation = isRecruitmentMockEnabled() && !siteKey;
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const emitToken = useCallback(
    (token: string | null) => {
      onTokenChange?.(token);
    },
    [onTokenChange]
  );

  const renderWidget = useCallback(() => {
    if (!siteKey || !window.turnstile) return;

    const host = hostRef.current;
    if (!host) return;

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(host, {
      sitekey: siteKey,
      callback: (token) => {
        setWidgetError(null);
        emitToken(token);
      },
      "expired-callback": () => {
        setWidgetError("Verification expired. Please complete the challenge again.");
        emitToken(null);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
      "error-callback": () => {
        setWidgetError("Verification failed. Please try again.");
        emitToken(null);
      },
      "timeout-callback": () => {
        setWidgetError("Verification timed out. Please try again.");
        emitToken(null);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    });
  }, [emitToken, siteKey]);

  useEffect(() => {
    if (!siteKey || !scriptReady) return;
    renderWidget();

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget, scriptReady, siteKey]);

  if (allowMockSimulation) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
        Mock verification is active for local development only.
        <button
          type="button"
          className="text-primary ml-2 underline"
          onClick={() => emitToken("mock-turnstile-token")}
        >
          Simulate verification
        </button>
      </div>
    );
  }

  if (!siteKey) {
    if (process.env.NODE_ENV === "production") {
      return (
        <p className="text-destructive text-sm" role="alert">
          Application verification is unavailable. Public applications cannot be submitted until
          Turnstile is configured.
        </p>
      );
    }

    return (
      <p className="text-muted-foreground text-xs">
        Turnstile is not configured. Production submissions will require verification.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src={TURNSTILE_SCRIPT}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() =>
          setWidgetError("Verification could not be loaded. Please refresh and try again.")
        }
      />
      <div ref={hostRef} className="min-h-[65px]" />
      {widgetError ? (
        <p className="text-destructive text-sm" role="alert">
          {widgetError}
        </p>
      ) : null}
    </div>
  );
}

export function isTurnstileRequired() {
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) {
    return true;
  }

  if (isRecruitmentMockEnabled()) {
    return false;
  }

  return process.env.NODE_ENV === "production";
}
