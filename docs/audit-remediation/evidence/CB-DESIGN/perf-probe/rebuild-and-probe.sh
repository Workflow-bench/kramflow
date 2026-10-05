#!/bin/bash
# Rebuild production, serve on 3959 (own server only), run Lighthouse mobile probe(s). Usage: rebuild-and-probe.sh <label> <runs>
set -u
cd "$(dirname "$0")/../../../../.."
LABEL=$1; RUNS=${2:-1}
D=docs/audit-remediation/evidence/CB-DESIGN/perf-probe
LH=~/.npm/_npx/0f94ee7615faf582/node_modules/lighthouse/cli/index.js
lsof -ti tcp:3959 | xargs -r kill; sleep 1
npx next build > $TMPDIR/build-$LABEL.log 2>&1 || { echo BUILD_FAILED; exit 1; }
(npx next start -p 3959 > $TMPDIR/next3959.log 2>&1 &); sleep 6
for i in $(seq 1 $RUNS); do
  node $LH http://localhost:3959/ --only-categories=performance,accessibility --form-factor=mobile --screenEmulation.mobile --quiet --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=$D/$LABEL-mobile-run$i.json >/dev/null 2>&1
done
lsof -ti tcp:3959 | xargs -r kill
for i in $(seq 1 $RUNS); do node -e 'const r=require(process.argv[1]);const a=r.audits;const e=a["lcp-breakdown-insight"].details.items.find(x=>x.lhId)||{};console.log(process.argv[1].split("/").pop(),"LCP",Math.round(a["largest-contentful-paint"].numericValue),"perf",r.categories.performance.score,"a11y",r.categories.accessibility.score,"CLS",a["cumulative-layout-shift"].numericValue,"elem",e.snippet?.slice(0,70))' $PWD/$D/$LABEL-mobile-run$i.json; done
