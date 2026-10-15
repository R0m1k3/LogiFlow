// Toutes les requêtes du banc, module par module
import type { ReadCase, WriteScenario } from "../types";
import * as socle from "./socle";
import * as referentiel from "./referentiel";

const modules = [socle, referentiel];

export const READS: ReadCase[] = modules.flatMap((m) => m.reads);
export const WRITES: WriteScenario[] = modules.flatMap((m) => m.writes);
