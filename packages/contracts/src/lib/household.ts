import { z } from 'zod';

/**
 * Un Compte du Foyer, tel qu'on le choisit comme Participant. Il ne porte que
 * de quoi le nommer : ni e-mail, ni sujet OIDC ne traversent la frontière.
 */
export const zHouseholdMember = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  displayName: /* @__PURE__ */ z.string(),
});

export type HouseholdMember = z.infer<typeof zHouseholdMember>;

/** Le Foyer du Compte connecté, et ses deux Comptes. */
export const zHousehold = /* @__PURE__ */ z.object({
  id: /* @__PURE__ */ z.string(),
  name: /* @__PURE__ */ z.string(),
  members: /* @__PURE__ */ z.array(zHouseholdMember),
});

export type Household = z.infer<typeof zHousehold>;
