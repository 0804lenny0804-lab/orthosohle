// Dieser Ablauf enthält ausschließlich synthetische Daten im Arbeitsspeicher.
// Eine Demo-Sitzung darf später niemals als echte Patientensitzung hochgeladen werden.
export type DemoSample = { kg: number; receivedAt: number };
export type DemoSession = {
  source: "demo";
  startedAt: number;
  endedAt: number | null;
  samples: DemoSample[];
};

export function startDemoSession(now: number): DemoSession {
  if (!Number.isFinite(now) || now < 0) throw new Error("Ungültige Zeit");
  return { source: "demo", startedAt: now, endedAt: null, samples: [] };
}

export function addDemoSample(
  session: DemoSession,
  kg: number,
  now: number,
): DemoSession {
  if (session.endedAt !== null) throw new Error("Sitzung beendet");
  const previousTime = session.samples.at(-1)?.receivedAt ?? session.startedAt;
  if (
    !Number.isFinite(kg) ||
    kg < 0 ||
    !Number.isFinite(now) ||
    now < previousTime
  ) {
    throw new Error("Ungültiger Messpunkt");
  }
  return { ...session, samples: [...session.samples, { kg, receivedAt: now }] };
}

export function endDemoSession(session: DemoSession, now: number): DemoSession {
  const previousTime = session.samples.at(-1)?.receivedAt ?? session.startedAt;
  if (session.endedAt !== null || !Number.isFinite(now) || now < previousTime) {
    throw new Error("Ungültiges Sitzungsende");
  }
  return { ...session, endedAt: now };
}
