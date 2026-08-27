/**
 * Le fil traceur du cloisonnement : une entité jouet qui porte un Espace et
 * n'existe que pour le démontrer de bout en bout. Elle disparaîtra quand un
 * vrai module portera un Espace.
 */
export interface Trace {
  id: string;
  label: string;
  scopeId: string;
  createdAt: string;
}

export interface TraceInput {
  label: string;
  scopeId: string;
}
