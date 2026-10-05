"use client";

import { useEffect } from "react";

import { assertOfferTokenNotPersisted } from "../utils/offer-response-security";

/** Dev/test guardrail — offer-response must never persist raw tokens client-side. */
export function useOfferResponseSecurityGuard() {
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
      return;
    }

    try {
      assertOfferTokenNotPersisted(window.localStorage);
      assertOfferTokenNotPersisted(window.sessionStorage);
    } catch (error) {
      console.error(error);
    }
  }, []);
}
