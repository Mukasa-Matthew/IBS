export const FailureDomain = {
  HEALTHY: 'HEALTHY',
  AREA_CORE_PATH_FAILURE: 'AREA_CORE_PATH_FAILURE',
  UPSTREAM_CONNECTIVITY_FAILURE: 'UPSTREAM_CONNECTIVITY_FAILURE',
  LOCAL_ACCESS_FAILURE: 'LOCAL_ACCESS_FAILURE',
  UNDETERMINED: 'UNDETERMINED',
};

export function localizeFailure(observation) {
  const local = Boolean(observation.local_access_reachable);
  const core = Boolean(observation.core_reachable);
  const internet = Boolean(observation.internet_reachable);

  const facts = [
    {
      key: 'local_access',
      ok: local,
      text: local ? 'Local access reachable' : 'Local access unreachable',
    },
    {
      key: 'core',
      ok: core,
      text: core ? 'Core reachable' : 'Core probe failed',
    },
    {
      key: 'internet',
      ok: internet,
      text: internet
        ? 'Internet reachable through area path'
        : 'Internet unavailable through area path',
    },
  ];

  if (local && core && internet) {
    return {
      domain: FailureDomain.HEALTHY,
      facts,
      inference: 'All reachability probes succeeded.',
      explanation:
        'Service area path to the internet appears healthy based on available telemetry.',
    };
  }

  if (local && !core && !internet) {
    return {
      domain: FailureDomain.AREA_CORE_PATH_FAILURE,
      facts,
      inference:
        'Area-to-core connectivity appears unavailable. Local access remains reachable.',
      explanation:
        'The service area local infrastructure is reachable but connectivity toward the core is unavailable. Possible causes include fibre, interface, routing, power or intermediate infrastructure. A physical root cause is not proven.',
    };
  }

  if (local && core && !internet) {
    return {
      domain: FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE,
      facts,
      inference:
        'External internet connectivity appears unavailable while local and core paths remain reachable.',
      explanation:
        'Local and core connectivity exist but external internet connectivity is unavailable.',
    };
  }

  if (!local && core && internet) {
    return {
      domain: FailureDomain.LOCAL_ACCESS_FAILURE,
      facts,
      inference: 'The problem appears to be within the local/access network.',
      explanation:
        'Local access is unreachable while core and internet probes from the monitoring vantage still succeed.',
    };
  }

  return {
    domain: FailureDomain.UNDETERMINED,
    facts,
    inference:
      'Failure location could not be confidently determined. Engineer investigation required.',
    explanation:
      'Observed probes are contradictory or insufficient to localize a failure domain. No root cause is asserted.',
  };
}

export function enrichFacts(result, consecutiveCount) {
  const facts = result.facts.map((fact) => {
    if (fact.key === 'core' && !fact.ok) {
      return {
        ...fact,
        text: `Core probe failed ${consecutiveCount} consecutive time${consecutiveCount === 1 ? '' : 's'}`,
      };
    }
    if (fact.key === 'internet' && !fact.ok) {
      return {
        ...fact,
        text: `Internet unavailable through area path (${consecutiveCount} consecutive observation${consecutiveCount === 1 ? '' : 's'})`,
      };
    }
    if (fact.key === 'local_access' && !fact.ok) {
      return {
        ...fact,
        text: `Local access unreachable (${consecutiveCount} consecutive observation${consecutiveCount === 1 ? '' : 's'})`,
      };
    }
    return fact;
  });
  return { ...result, facts, consecutiveCount };
}

export function displayNameForDomain(domain) {
  switch (domain) {
    case FailureDomain.AREA_CORE_PATH_FAILURE:
      return 'Area-to-core connectivity';
    case FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE:
      return 'Upstream internet connectivity';
    case FailureDomain.LOCAL_ACCESS_FAILURE:
      return 'Local/access network';
    case FailureDomain.UNDETERMINED:
      return 'Undetermined';
    default:
      return 'Healthy';
  }
}
