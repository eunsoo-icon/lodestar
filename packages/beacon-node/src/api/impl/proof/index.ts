import {createProof, ProofType} from "@chainsafe/persistent-merkle-tree";
import {routes, ServerApi} from "@lodestar/api";
import {Slot} from "@lodestar/types";
import {ApiModules} from "../types.js";
import {resolveStateId} from "../beacon/state/utils.js";
import {resolveBlockId} from "../beacon/blocks/utils.js";
import {ApiOptions} from "../../options.js";

export function getProofApi(
  opts: ApiOptions,
  {chain, config, db}: Pick<ApiModules, "chain" | "config" | "db">
): ServerApi<routes.proof.Api> {
  // It's currently possible to request gigantic proofs (eg: a proof of the entire beacon state)
  // We want some some sort of resistance against this DoS vector.
  const maxGindicesInProof = opts.maxGindicesInProof ?? 512;

  return {
    async getStateProof(stateId, descriptor) {
      // descriptor.length / 2 is a rough approximation of # of gindices
      if (descriptor.length / 2 > maxGindicesInProof) {
        throw new Error("Requested proof is too large.");
      }

      const {state} = await resolveStateId(chain, stateId);

      // Commit any changes before computing the state root. In normal cases the state should have no changes here
      state.commit();
      const stateNode = state.node;

      const data = createProof(stateNode, {type: ProofType.compactMulti, descriptor});

      return {data};
    },
    async getBlockProof(blockId, descriptor) {
      // descriptor.length / 2 is a rough approximation of # of gindices
      if (descriptor.length / 2 > maxGindicesInProof) {
        throw new Error("Requested proof is too large.");
      }

      const {block} = await resolveBlockId(chain, blockId);

      // Commit any changes before computing the state root. In normal cases the state should have no changes here
      const blockNode = config.getForkTypes(block.message.slot).BeaconBlock.toView(block.message).node;

      const data = createProof(blockNode, {type: ProofType.compactMulti, descriptor});

      return {data};
    },
    async getStateReceiptsRootProof(slot: Slot) {
      const data = await db.receiptsRootProof.get(slot);
      if (!data) {
        throw new Error("Can't find proof for slot: " + slot);
      }
      return {data: data};
    },
    async getStateProofWithGIndex(stateId: string, gindex: number) {
      const {state} = await resolveStateId(chain, stateId);

      // Commit any changes before computing the state root. In normal cases the state should have no changes here
      state.commit();
      const stateNode = state.node;
      const data = createProof(stateNode, {type: ProofType.single, gindex: BigInt(gindex)});
      return {data};
    },
  };
}
