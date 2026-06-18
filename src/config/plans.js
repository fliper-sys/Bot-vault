/**
 * BotVault Data Plans Config
 * 6 detailed plans for MTN, Airtel, Glo, and 9mobile
 */

export const plans = {
  MTN: [
    { id: "mtn-1", name: "1GB - Daily (24 Hrs)", amount: 350 },
    { id: "mtn-2", name: "2.5GB - 2 Days", amount: 600 },
    { id: "mtn-3", name: "3.5GB - Weekly (7 Days)", amount: 1200 },
    { id: "mtn-4", name: "10GB - Monthly (30 Days)", amount: 3500 },
    { id: "mtn-5", name: "20GB - Monthly (30 Days)", amount: 6000 },
    { id: "mtn-6", name: "40GB - Monthly (30 Days)", amount: 11000 }
  ],
  Airtel: [
    { id: "airtel-1", name: "1GB - Daily (24 Hrs)", amount: 350 },
    { id: "airtel-2", name: "2GB - 3 Days", amount: 550 },
    { id: "airtel-3", name: "3GB - Weekly (7 Days)", amount: 1000 },
    { id: "airtel-4", name: "10GB - Monthly (30 Days)", amount: 3000 },
    { id: "airtel-5", name: "20GB - Monthly (30 Days)", amount: 5500 },
    { id: "airtel-6", name: "40GB - Monthly (30 Days)", amount: 10000 }
  ],
  Glo: [
    { id: "glo-1", name: "1.35GB - Daily (24 Hrs)", amount: 300 },
    { id: "glo-2", name: "2.9GB - 2 Days", amount: 500 },
    { id: "glo-3", name: "5.8GB - Weekly (7 Days)", amount: 1000 },
    { id: "glo-4", name: "10GB - Monthly (30 Days)", amount: 2500 },
    { id: "glo-5", name: "18GB - Monthly (30 Days)", amount: 4000 },
    { id: "glo-6", name: "40GB - Monthly (30 Days)", amount: 8000 }
  ],
  "9mobile": [
    { id: "9mobile-1", name: "1GB - Daily (24 Hrs)", amount: 300 },
    { id: "9mobile-2", name: "2GB - 3 Days", amount: 500 },
    { id: "9mobile-3", name: "3GB - Weekly (7 Days)", amount: 1000 },
    { id: "9mobile-4", name: "10GB - Monthly (30 Days)", amount: 3000 },
    { id: "9mobile-5", name: "15GB - Monthly (30 Days)", amount: 4000 },
    { id: "9mobile-6", name: "40GB - Monthly (30 Days)", amount: 9000 }
  ]
};

export const getPlanById = (planId) => {
  for (const network of Object.keys(plans)) {
    const found = plans[network].find(p => p.id === planId);
    if (found) {
      return { ...found, network };
    }
  }
  return null;
};
