"use client";

import { useEffect, useMemo, useState } from "react";

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function useEventAccessGuard(eventId, buildQueryString) {
  const normalizedEventId = useMemo(() => toPositiveInteger(eventId), [eventId]);
  const [state, setState] = useState({
    checkingEventAccess: true,
    isEventAllowed: false,
    storyModeEnabled: true,
  });

  const eventNotFoundHref = useMemo(() => {
    if (typeof buildQueryString !== "function") return "/event-not-found";
    const queryString = buildQueryString({
      eventId: normalizedEventId ? String(normalizedEventId) : null,
      questId: null,
    });
    return `/event-not-found${queryString}`;
  }, [buildQueryString, normalizedEventId]);

  useEffect(() => {
    let mounted = true;

    async function checkEventAccess() {
      if (!normalizedEventId) {
        if (!mounted) return;
        setState({
          checkingEventAccess: false,
          isEventAllowed: false,
          storyModeEnabled: true,
        });
        return;
      }

      if (!mounted) return;
      setState((previous) => ({
        ...previous,
        checkingEventAccess: true,
      }));

      let isEventAllowed = false;
      try {
        const response = await fetch(
          `/api/events/access?eventId=${encodeURIComponent(normalizedEventId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (response.ok) {
          const payload = await response.json();
          isEventAllowed = payload?.exists === true && payload?.isActive === true;
          if (!mounted) return;
          setState({
            checkingEventAccess: false,
            isEventAllowed,
            storyModeEnabled: payload?.storyModeEnabled !== false,
          });
          return;
        } else {
          isEventAllowed = false;
        }
      } catch {
        isEventAllowed = false;
      }

      if (!mounted) return;

      setState({
        checkingEventAccess: false,
        isEventAllowed,
        storyModeEnabled: true,
      });
    }

    checkEventAccess();

    return () => {
      mounted = false;
    };
  }, [normalizedEventId]);

  return {
    checkingEventAccess: state.checkingEventAccess,
    isEventAllowed: state.isEventAllowed,
    storyModeEnabled: state.storyModeEnabled,
    normalizedEventId,
    eventNotFoundHref,
  };
}
