import { FailureDomain } from './engine.js';

export function planIncidents(readyFailures) {
  const plans = [];
  const upstream = readyFailures.filter(
    (item) => item.domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE,
  );
  const others = readyFailures.filter(
    (item) => item.domain !== FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE,
  );

  if (upstream.length >= 2) {
    plans.push({
      domain: FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE,
      areas: upstream.map((item) => item.area),
      shared: true,
    });
  } else {
    for (const item of upstream) {
      plans.push({
        domain: FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE,
        areas: [item.area],
        shared: false,
      });
    }
  }

  for (const item of others) {
    plans.push({
      domain: item.domain,
      areas: [item.area],
      shared: false,
    });
  }

  return plans;
}
