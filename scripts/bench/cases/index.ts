// Toutes les requêtes du banc, une liste par lot (docs/PLAN-MIGRATION-RUST.md)
import type { ReadCase, WriteScenario } from "../types";
import * as socle from "./socle";
import * as referentiel from "./referentiel";
import * as informations from "./informations";
import * as quotidien from "./quotidien";
import * as fournisseursServices from "./fournisseurs-services";
import * as fournisseursCommandes from "./fournisseurs-commandes";
import * as fournisseursRapprochement from "./fournisseurs-rapprochement";
import * as administration from "./administration";

const modules = [
  socle,
  referentiel,
  informations,
  quotidien,
  fournisseursServices,
  fournisseursCommandes,
  fournisseursRapprochement,
  administration,
];

export const READS: ReadCase[] = modules.flatMap((m) => m.reads);
export const WRITES: WriteScenario[] = modules.flatMap((m) => m.writes);
