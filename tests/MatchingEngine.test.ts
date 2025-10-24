/** @format */

import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, stringAsciiCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_INVENTORY = 101;
const ERR_INVALID_REQUEST = 102;
const ERR_NO_MATCH = 103;
const ERR_INVALID_QUANTITY = 104;
const ERR_INVALID_EXPIRY = 105;
const ERR_INVALID_DRUG_TYPE = 106;
const ERR_INVALID_DISTANCE = 112;
const ERR_INVALID_PRIORITY = 113;
const ERR_MATCH_ALREADY_EXISTS = 110;
const ERR_MATCH_NOT_FOUND = 111;
const ERR_MAX_MATCHES_EXCEEDED = 114;
const ERR_AUTHORITY_NOT_VERIFIED = 116;
const ERR_INVALID_UPDATE_PARAM = 117;
const ERR_UPDATE_NOT_ALLOWED = 118;

interface Match {
  inventoryId: number;
  requestId: number;
  donor: string;
  recipient: string;
  quantity: number;
  drugType: string;
  expiryDate: number;
  distance: number;
  priority: number;
  status: string;
  timestamp: number;
}

interface MatchUpdate {
  updateQuantity: number;
  updateExpiry: number;
  updateTimestamp: number;
  updater: string;
}

interface Inventory {
  owner: string;
  quantity: number;
  drugType: string;
  expiryDate: number;
}

interface Request {
  requester: string;
  quantity: number;
  drugType: string;
  urgency: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class MatchingEngineMock {
  state: {
    nextMatchId: number;
    maxMatches: number;
    matchFee: number;
    authorityContract: string | null;
    matches: Map<number, Match>;
    matchUpdates: Map<number, MatchUpdate>;
    matchesByInventory: Map<number, number>;
    matchesByRequest: Map<number, number>;
  } = {
    nextMatchId: 0,
    maxMatches: 10000,
    matchFee: 100,
    authorityContract: null,
    matches: new Map(),
    matchUpdates: new Map(),
    matchesByInventory: new Map(),
    matchesByRequest: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  inventories: Map<number, Inventory> = new Map();
  requests: Map<number, Request> = new Map();
  verifiedMatches: Set<number> = new Set();
  mintedRewards: Array<{ to: string; amount: number }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextMatchId: 0,
      maxMatches: 10000,
      matchFee: 100,
      authorityContract: null,
      matches: new Map(),
      matchUpdates: new Map(),
      matchesByInventory: new Map(),
      matchesByRequest: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.inventories = new Map();
    this.requests = new Map();
    this.verifiedMatches = new Set();
    this.mintedRewards = [];
  }

  addInventory(id: number, inventory: Inventory) {
    this.inventories.set(id, inventory);
  }

  addRequest(id: number, request: Request) {
    this.requests.set(id, request);
  }

  getInventory(id: number): Result<Inventory> {
    const inv = this.inventories.get(id);
    return inv ? { ok: true, value: inv } : { ok: false, value: null as any };
  }

  getRequest(id: number): Result<Request> {
    const req = this.requests.get(id);
    return req ? { ok: true, value: req } : { ok: false, value: null as any };
  }

  listAvailableInventories(drugType: string): number[] {
    const list: number[] = [];
    this.inventories.forEach((inv, id) => {
      if (
        inv.drugType === drugType &&
        inv.quantity > 0 &&
        inv.expiryDate > this.blockHeight
      ) {
        list.push(id);
      }
    });
    return list;
  }

  initiateTransfer(
    matchId: number,
    inventoryId: number,
    requestId: number
  ): Result<boolean> {
    return { ok: true, value: true };
  }

  isVerified(matchId: number): boolean {
    return this.verifiedMatches.has(matchId);
  }

  mintReward(to: string, amount: number): Result<boolean> {
    this.mintedRewards.push({ to, amount });
    return { ok: true, value: true };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxMatches(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxMatches = newMax;
    return { ok: true, value: true };
  }

  setMatchFee(newFee: number): Result<boolean> {
    if (newFee < 0) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.matchFee = newFee;
    return { ok: true, value: true };
  }

  createMatch(
    inventoryId: number,
    requestId: number,
    quantity: number,
    drugType: string,
    expiryDate: number,
    distance: number,
    priority: number
  ): Result<number> {
    if (this.state.nextMatchId >= this.state.maxMatches)
      return { ok: false, value: ERR_MAX_MATCHES_EXCEEDED };
    const inventoryResult = this.getInventory(inventoryId);
    if (!inventoryResult.ok) return { ok: false, value: ERR_INVALID_INVENTORY };
    const inventory = inventoryResult.value;
    const requestResult = this.getRequest(requestId);
    if (!requestResult.ok) return { ok: false, value: ERR_INVALID_REQUEST };
    const request = requestResult.value;
    const donor = inventory.owner;
    const recipient = request.requester;
    if (quantity <= 0) return { ok: false, value: ERR_INVALID_QUANTITY };
    if (expiryDate <= this.blockHeight)
      return { ok: false, value: ERR_INVALID_EXPIRY };
    if (drugType.length === 0)
      return { ok: false, value: ERR_INVALID_DRUG_TYPE };
    if (distance > 1000) return { ok: false, value: ERR_INVALID_DISTANCE };
    if (priority > 10) return { ok: false, value: ERR_INVALID_PRIORITY };
    if (inventory.drugType !== drugType)
      return { ok: false, value: ERR_INVALID_DRUG_TYPE };
    if (request.drugType !== drugType)
      return { ok: false, value: ERR_INVALID_DRUG_TYPE };
    if (inventory.quantity < quantity)
      return { ok: false, value: ERR_INVALID_QUANTITY };
    if (request.quantity < quantity)
      return { ok: false, value: ERR_INVALID_QUANTITY };
    if (this.caller !== donor) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.matchesByInventory.has(inventoryId))
      return { ok: false, value: ERR_MATCH_ALREADY_EXISTS };
    if (this.state.matchesByRequest.has(requestId))
      return { ok: false, value: ERR_MATCH_ALREADY_EXISTS };
    if (!this.state.authorityContract)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({
      amount: this.state.matchFee,
      from: this.caller,
      to: this.state.authorityContract,
    });

    const id = this.state.nextMatchId;
    const match: Match = {
      inventoryId,
      requestId,
      donor,
      recipient,
      quantity,
      drugType,
      expiryDate,
      distance,
      priority,
      status: "pending",
      timestamp: this.blockHeight,
    };
    this.state.matches.set(id, match);
    this.state.matchesByInventory.set(inventoryId, id);
    this.state.matchesByRequest.set(requestId, id);
    this.state.nextMatchId++;
    this.initiateTransfer(id, inventoryId, requestId);
    return { ok: true, value: id };
  }

  updateMatch(
    id: number,
    updateQuantity: number,
    updateExpiry: number
  ): Result<boolean> {
    const match = this.state.matches.get(id);
    if (!match) return { ok: false, value: ERR_MATCH_NOT_FOUND };
    if (match.donor !== this.caller)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (updateQuantity <= 0) return { ok: false, value: ERR_INVALID_QUANTITY };
    if (updateExpiry <= this.blockHeight)
      return { ok: false, value: ERR_INVALID_EXPIRY };
    const updated: Match = {
      ...match,
      quantity: updateQuantity,
      expiryDate: updateExpiry,
      timestamp: this.blockHeight,
    };
    this.state.matches.set(id, updated);
    this.state.matchUpdates.set(id, {
      updateQuantity,
      updateExpiry,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  cancelMatch(id: number): Result<boolean> {
    const match = this.state.matches.get(id);
    if (!match) return { ok: false, value: ERR_MATCH_NOT_FOUND };
    if (match.donor !== this.caller && match.recipient !== this.caller)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (match.status !== "pending")
      return { ok: false, value: ERR_UPDATE_NOT_ALLOWED };
    const updated: Match = {
      ...match,
      status: "cancelled",
      timestamp: this.blockHeight,
    };
    this.state.matches.set(id, updated);
    this.state.matchesByInventory.delete(match.inventoryId);
    this.state.matchesByRequest.delete(match.requestId);
    return { ok: true, value: true };
  }

  confirmMatch(id: number): Result<boolean> {
    const match = this.state.matches.get(id);
    if (!match) return { ok: false, value: ERR_MATCH_NOT_FOUND };
    if (match.recipient !== this.caller)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (match.status !== "pending")
      return { ok: false, value: ERR_UPDATE_NOT_ALLOWED };
    const updated: Match = {
      ...match,
      status: "matched",
      timestamp: this.blockHeight,
    };
    this.state.matches.set(id, updated);
    return { ok: true, value: true };
  }

  completeMatch(id: number): Result<boolean> {
    const match = this.state.matches.get(id);
    if (!match) return { ok: false, value: ERR_MATCH_NOT_FOUND };
    if (!this.isVerified(id)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (match.status !== "matched")
      return { ok: false, value: ERR_UPDATE_NOT_ALLOWED };
    const updated: Match = {
      ...match,
      status: "completed",
      timestamp: this.blockHeight,
    };
    this.state.matches.set(id, updated);
    this.mintReward(match.donor, match.quantity);
    return { ok: true, value: true };
  }

  autoMatchUrgent(
    requestId: number
  ): Result<{ requestId: number; matchFound: number | null }> {
    const requestResult = this.getRequest(requestId);
    if (!requestResult.ok) return { ok: false, value: null as any };
    const request = requestResult.value;
    if (!request.urgency) return { ok: false, value: null as any };
    if (!this.state.authorityContract) return { ok: false, value: null as any };
    const inventoryList = this.listAvailableInventories(request.drugType);
    let state: { requestId: number; matchFound: number | null } = {
      requestId,
      matchFound: null,
    };
    for (const inventoryId of inventoryList) {
      if (state.matchFound !== null) break;
      const inventory = this.getInventory(inventoryId).value;
      const quantity = Math.min(inventory.quantity, request.quantity);
      const drugType = inventory.drugType;
      const expiryDate = inventory.expiryDate;
      const distance = 500;
      const priority = 10;
      if (
        inventory.drugType === request.drugType &&
        inventory.quantity >= request.quantity &&
        inventory.expiryDate > this.blockHeight &&
        distance <= 1000
      ) {
        const matchResult = this.createMatch(
          inventoryId,
          requestId,
          quantity,
          drugType,
          expiryDate,
          distance,
          priority
        );
        if (matchResult.ok) {
          state.matchFound = matchResult.value;
        }
      }
    }
    return { ok: true, value: state };
  }

  getMatch(id: number): Match | null {
    return this.state.matches.get(id) || null;
  }

  getMatchCount(): Result<number> {
    return { ok: true, value: this.state.nextMatchId };
  }
}

describe("MatchingEngine", () => {
  let contract: MatchingEngineMock;

  beforeEach(() => {
    contract = new MatchingEngineMock();
    contract.reset();
  });

  it("creates a match successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    const result = contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const match = contract.getMatch(0);
    expect(match?.inventoryId).toBe(0);
    expect(match?.requestId).toBe(0);
    expect(match?.donor).toBe("ST1TEST");
    expect(match?.recipient).toBe("ST3RECIP");
    expect(match?.quantity).toBe(50);
    expect(match?.drugType).toBe("Aspirin");
    expect(match?.expiryDate).toBe(1000);
    expect(match?.distance).toBe(200);
    expect(match?.priority).toBe(5);
    expect(match?.status).toBe("pending");
    expect(contract.stxTransfers).toEqual([
      { amount: 100, from: "ST1TEST", to: "ST2TEST" },
    ]);
  });

  it("rejects match with invalid quantity", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    const result = contract.createMatch(0, 0, 0, "Aspirin", 1000, 200, 5);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_QUANTITY);
  });

  it("rejects match without authority contract", () => {
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    const result = contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects match with mismatched drug type", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Ibuprofen",
      urgency: true,
    });
    const result = contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DRUG_TYPE);
  });

  it("rejects match by non-donor", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST4OTHER",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    const result = contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("updates a match successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    const result = contract.updateMatch(0, 40, 1100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const match = contract.getMatch(0);
    expect(match?.quantity).toBe(40);
    expect(match?.expiryDate).toBe(1100);
    const update = contract.state.matchUpdates.get(0);
    expect(update?.updateQuantity).toBe(40);
    expect(update?.updateExpiry).toBe(1100);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent match", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateMatch(99, 40, 1100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MATCH_NOT_FOUND);
  });

  it("rejects update by non-donor", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    contract.caller = "ST5FAKE";
    const result = contract.updateMatch(0, 40, 1100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("cancels a match successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    const result = contract.cancelMatch(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const match = contract.getMatch(0);
    expect(match?.status).toBe("cancelled");
    expect(contract.state.matchesByInventory.has(0)).toBe(false);
    expect(contract.state.matchesByRequest.has(0)).toBe(false);
  });



  it("confirms a match successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    contract.caller = "ST3RECIP";
    const result = contract.confirmMatch(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const match = contract.getMatch(0);
    expect(match?.status).toBe("matched");
  });

  it("rejects confirm by non-recipient", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    const result = contract.confirmMatch(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("completes a match successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    contract.caller = "ST3RECIP";
    contract.confirmMatch(0);
    contract.verifiedMatches.add(0);
    const result = contract.completeMatch(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const match = contract.getMatch(0);
    expect(match?.status).toBe("completed");
    expect(contract.mintedRewards).toEqual([{ to: "ST1TEST", amount: 50 }]);
  });

  it("rejects complete without verification", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    contract.caller = "ST3RECIP";
    contract.confirmMatch(0);
    const result = contract.completeMatch(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("auto-matches urgent request successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    const result = contract.autoMatchUrgent(0);
    expect(result.ok).toBe(true);
    expect(result.value.matchFound).toBe(0);
    const match = contract.getMatch(0);
    expect(match?.quantity).toBe(50);
    expect(match?.status).toBe("pending");
  });

  it("rejects auto-match for non-urgent request", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: false,
    });
    const result = contract.autoMatchUrgent(0);
    expect(result.ok).toBe(false);
  });

  it("sets match fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setMatchFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.matchFee).toBe(200);
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    expect(contract.stxTransfers).toEqual([
      { amount: 200, from: "ST1TEST", to: "ST2TEST" },
    ]);
  });

  it("rejects match fee change without authority", () => {
    const result = contract.setMatchFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct match count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    contract.addInventory(1, {
      owner: "ST1TEST",
      quantity: 200,
      drugType: "Ibuprofen",
      expiryDate: 2000,
    });
    contract.addRequest(1, {
      requester: "ST6RECIP",
      quantity: 100,
      drugType: "Ibuprofen",
      urgency: true,
    });
    contract.createMatch(1, 1, 100, "Ibuprofen", 2000, 300, 6);
    const result = contract.getMatchCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("parses match parameters with Clarity types", () => {
    const drugType = stringAsciiCV("Aspirin");
    const quantity = uintCV(50);
    const expiry = uintCV(1000);
    expect(drugType.value).toBe("Aspirin");
    expect(quantity.value).toEqual(BigInt(50));
    expect(expiry.value).toEqual(BigInt(1000));
  });

  it("rejects match creation with max matches exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxMatches = 1;
    contract.addInventory(0, {
      owner: "ST1TEST",
      quantity: 100,
      drugType: "Aspirin",
      expiryDate: 1000,
    });
    contract.addRequest(0, {
      requester: "ST3RECIP",
      quantity: 50,
      drugType: "Aspirin",
      urgency: true,
    });
    contract.createMatch(0, 0, 50, "Aspirin", 1000, 200, 5);
    contract.addInventory(1, {
      owner: "ST1TEST",
      quantity: 200,
      drugType: "Ibuprofen",
      expiryDate: 2000,
    });
    contract.addRequest(1, {
      requester: "ST6RECIP",
      quantity: 100,
      drugType: "Ibuprofen",
      urgency: true,
    });
    const result = contract.createMatch(1, 1, 100, "Ibuprofen", 2000, 300, 6);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_MATCHES_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract(
      "SP000000000000000000002Q6VF78"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});
