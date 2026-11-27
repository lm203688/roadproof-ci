"""CI-only patcher: injects a hands-free UI tour for simulator screen recordings.

The patch is applied inside the GitHub Actions workspace only; the repository
source is never modified. The shipped binary is unaffected: the tour code is
gated behind EXPO_PUBLIC_TOUR === '1', which release builds never set.
"""

import pathlib

APP_TOUR = """
  // CI recording tour: only active when EXPO_PUBLIC_TOUR=1 at bundle time.
  useEffect(() => {
    let alive = true;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1800);
      if (!alive) return;
      await addUnit({
        number: 'UNIT 104',
        plate: 'TX4821',
        plateState: 'TX',
        type: 'tractor',
        tows: false,
        placardPsi: '110',
        annualInspectionDue: '2027-03-31',
        registrationDue: '2027-01-31',
        insuranceDue: '2026-12-31',
      });
      await wait(1200);
      if (!alive) return;
      setTab('truck');
      await wait(3600);
      if (!alive) return;
      setTab('inspect');
      await wait(42000);
      if (!alive) return;
      setTab('record');
      await wait(6000);
      if (!alive) return;
      setTab('defects');
    })();
    return () => {
      alive = false;
    };
  }, []);
"""

INSPECT_TOUR = """
  // CI recording tour: fills the checklist the way a driver would, then signs.
  const tourStarted = useRef(false);
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!unit || tourStarted.current) return undefined;
    tourStarted.current = true;
    let alive = true;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      if (!alive) return;
      setOdometer('184320');
      const ids = checklist.map((c) => c.id).filter((id) => id !== 'fifthwheel' && id !== 'airlines');
      for (let i = 0; i < ids.length; i += 1) {
        if (!alive) return;
        const id = ids[i];
        const state = id === 'marker' ? 'def' : 'ok';
        setResults((r) => ({ ...r, [id]: { state, value: r[id] ? r[id].value : null } }));
        if (id === 'tread') setResults((r) => ({ ...r, tread: { state: 'ok', value: 6 } }));
        if (id === 'tirepressure') setResults((r) => ({ ...r, tirepressure: { state: 'ok', value: 105 } }));
        await wait(1150);
      }
      if (!alive) return;
      setSignature('L. Xing');
      await wait(1400);
      if (!alive) return;
      if (submitRef.current) submitRef.current();
    })();
    return () => {
      alive = false;
    };
  }, [unit]);
"""


def patch():
    app = pathlib.Path("App.js")
    s = app.read_text()
    anchor = "  const common = { unit, onNav: setTab };"
    if anchor not in s:
        raise SystemExit("App.js anchor missing")
    if "CI recording tour" in s:
        print("App.js already patched")
    else:
        app.write_text(s.replace(anchor, anchor + "\n" + APP_TOUR, 1))
        print("App.js patched")

    ins = pathlib.Path("src/screens/InspectScreen.js")
    t = ins.read_text()
    old_import = "import React, { useMemo, useState } from 'react';"
    if old_import not in t:
        raise SystemExit("InspectScreen import anchor missing")
    t = t.replace(old_import, "import React, { useMemo, useState, useEffect, useRef } from 'react';", 1)
    anchor2 = "  const unitLabel = `${unit.number}${requiresCoupling ? ' + trailer' : ''}`;"
    if anchor2 not in t:
        raise SystemExit("InspectScreen unitLabel anchor missing")
    t = t.replace(anchor2, INSPECT_TOUR + "\n" + anchor2, 1)
    ins.write_text(t)
    print("InspectScreen patched")


if __name__ == "__main__":
    patch()



