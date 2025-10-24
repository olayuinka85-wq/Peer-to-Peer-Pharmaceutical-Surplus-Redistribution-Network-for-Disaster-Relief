(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-INVENTORY u101)
(define-constant ERR-INVALID-REQUEST u102)
(define-constant ERR-NO-MATCH u103)
(define-constant ERR-INVALID-QUANTITY u104)
(define-constant ERR-INVALID-EXPIRY u105)
(define-constant ERR-INVALID-DRUG-TYPE u106)
(define-constant ERR-INVALID-LOCATION u107)
(define-constant ERR-INVALID-URGENCY u108)
(define-constant ERR-INVALID-STATUS u109)
(define-constant ERR-MATCH-ALREADY-EXISTS u110)
(define-constant ERR-MATCH-NOT-FOUND u111)
(define-constant ERR-INVALID-DISTANCE u112)
(define-constant ERR-INVALID-PRIORITY u113)
(define-constant ERR-MAX-MATCHES_EXCEEDED u114)
(define-constant ERR-INVALID-TIMESTAMP u115)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u116)
(define-constant ERR-INVALID-UPDATE-PARAM u117)
(define-constant ERR-UPDATE-NOT-ALLOWED u118)

(define-data-var next-match-id uint u0)
(define-data-var max-matches uint u10000)
(define-data-var authority-contract (optional principal) none)
(define-data-var match-fee uint u100)

(define-map Matches
  { match-id: uint }
  {
    inventory-id: uint,
    request-id: uint,
    donor: principal,
    recipient: principal,
    quantity: uint,
    drug-type: (string-ascii 50),
    expiry-date: uint,
    distance: uint,
    priority: uint,
    status: (string-ascii 20),
    timestamp: uint
  }
)

(define-map MatchesByInventory
  uint
  uint
)

(define-map MatchesByRequest
  uint
  uint
)

(define-map MatchUpdates
  uint
  {
    update-quantity: uint,
    update-expiry: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-match (id uint))
  (map-get? Matches { match-id: id })
)

(define-read-only (get-match-update (id uint))
  (map-get? MatchUpdates id)
)

(define-read-only (get-match-by-inventory (inv-id uint))
  (map-get? MatchesByInventory inv-id)
)

(define-read-only (get-match-by-request (req-id uint))
  (map-get? MatchesByRequest req-id)
)

(define-private (validate-quantity (qty uint))
  (if (> qty u0)
      (ok true)
      (err ERR-INVALID-QUANTITY))
)

(define-private (validate-expiry (exp uint))
  (if (> exp block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)

(define-private (validate-drug-type (typ (string-ascii 50)))
  (if (> (len typ) u0)
      (ok true)
      (err ERR-INVALID-DRUG-TYPE))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (> (len loc) u0)
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-urgency (urg bool))
  (ok true)
)

(define-private (validate-status (stat (string-ascii 20)))
  (if (or (is-eq stat "pending") (is-eq stat "matched") (is-eq stat "completed") (is-eq stat "cancelled"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (validate-distance (dist uint))
  (if (<= dist u1000)
      (ok true)
      (err ERR-INVALID-DISTANCE))
)

(define-private (validate-priority (pri uint))
  (if (<= pri u10)
      (ok true)
      (err ERR-INVALID-PRIORITY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-matches (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-matches new-max)
    (ok true)
  )
)

(define-public (set-match-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set match-fee new-fee)
    (ok true)
  )
)

(define-public (create-match (inventory-id uint) (request-id uint) (quantity uint) (drug-type (string-ascii 50)) (expiry-date uint) (distance uint) (priority uint))
  (let
    (
      (next-id (var-get next-match-id))
      (current-max (var-get max-matches))
      (authority (var-get authority-contract))
      (inventory (unwrap! (contract-call? .InventoryManager get-inventory inventory-id) (err ERR-INVALID-INVENTORY)))
      (request (unwrap! (contract-call? .RequestManager get-request request-id) (err ERR-INVALID-REQUEST)))
      (donor (get owner inventory))
      (recipient (get requester request))
    )
    (asserts! (< next-id current-max) (err ERR-MAX-MATCHES-EXCEEDED))
    (try! (validate-quantity quantity))
    (try! (validate-drug-type drug-type))
    (try! (validate-expiry expiry-date))
    (try! (validate-distance distance))
    (try! (validate-priority priority))
    (asserts! (is-eq (get drug-type inventory) drug-type) (err ERR-INVALID-DRUG-TYPE))
    (asserts! (is-eq (get drug-type request) drug-type) (err ERR-INVALID-DRUG-TYPE))
    (asserts! (>= (get quantity inventory) quantity) (err ERR-INVALID-QUANTITY))
    (asserts! (>= (get quantity request) quantity) (err ERR-INVALID-QUANTITY))
    (asserts! (is-eq tx-sender donor) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (map-get? MatchesByInventory inventory-id)) (err ERR-MATCH-ALREADY-EXISTS))
    (asserts! (is-none (map-get? MatchesByRequest request-id)) (err ERR-MATCH-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get match-fee) tx-sender authority-recipient))
    )
    (map-set Matches { match-id: next-id }
      {
        inventory-id: inventory-id,
        request-id: request-id,
        donor: donor,
        recipient: recipient,
        quantity: quantity,
        drug-type: drug-type,
        expiry-date: expiry-date,
        distance: distance,
        priority: priority,
        status: "pending",
        timestamp: block-height
      }
    )
    (map-set MatchesByInventory inventory-id next-id)
    (map-set MatchesByRequest request-id next-id)
    (var-set next-match-id (+ next-id u1))
    (try! (contract-call? .EscrowTransfer initiate-transfer next-id inventory-id request-id))
    (print { event: "match-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-match (match-id uint) (update-quantity uint) (update-expiry uint))
  (let ((match-opt (map-get? Matches { match-id: match-id })))
    (match match-opt
      m
      (begin
        (asserts! (is-eq (get donor m) tx-sender) (err ERR-NOT-AUTHORIZED))
        (try! (validate-quantity update-quantity))
        (try! (validate-expiry update-expiry))
        (map-set Matches { match-id: match-id }
          {
            inventory-id: (get inventory-id m),
            request-id: (get request-id m),
            donor: (get donor m),
            recipient: (get recipient m),
            quantity: update-quantity,
            drug-type: (get drug-type m),
            expiry-date: update-expiry,
            distance: (get distance m),
            priority: (get priority m),
            status: (get status m),
            timestamp: block-height
          }
        )
        (map-set MatchUpdates match-id
          {
            update-quantity: update-quantity,
            update-expiry: update-expiry,
            update-timestamp: block-height,
            updater: tx-sender
          }
        )
        (print { event: "match-updated", id: match-id })
        (ok true)
      )
      (err ERR-MATCH-NOT-FOUND)
    )
  )
)

(define-public (cancel-match (match-id uint))
  (let ((match-opt (map-get? Matches { match-id: match-id })))
    (match match-opt
      m
      (begin
        (asserts! (or (is-eq (get donor m) tx-sender) (is-eq (get recipient m) tx-sender)) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status m) "pending") (err ERR-UPDATE-NOT-ALLOWED))
        (map-set Matches { match-id: match-id }
          {
            inventory-id: (get inventory-id m),
            request-id: (get request-id m),
            donor: (get donor m),
            recipient: (get recipient m),
            quantity: (get quantity m),
            drug-type: (get drug-type m),
            expiry-date: (get expiry-date m),
            distance: (get distance m),
            priority: (get priority m),
            status: "cancelled",
            timestamp: block-height
          }
        )
        (map-delete MatchesByInventory (get inventory-id m))
        (map-delete MatchesByRequest (get request-id m))
        (print { event: "match-cancelled", id: match-id })
        (ok true)
      )
      (err ERR-MATCH-NOT-FOUND)
    )
  )
)

(define-public (confirm-match (match-id uint))
  (let ((match-opt (map-get? Matches { match-id: match-id })))
    (match match-opt
      m
      (begin
        (asserts! (is-eq (get recipient m) tx-sender) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status m) "pending") (err ERR-UPDATE-NOT-ALLOWED))
        (map-set Matches { match-id: match-id }
          {
            inventory-id: (get inventory-id m),
            request-id: (get request-id m),
            donor: (get donor m),
            recipient: (get recipient m),
            quantity: (get quantity m),
            drug-type: (get drug-type m),
            expiry-date: (get expiry-date m),
            distance: (get distance m),
            priority: (get priority m),
            status: "matched",
            timestamp: block-height
          }
        )
        (print { event: "match-confirmed", id: match-id })
        (ok true)
      )
      (err ERR-MATCH-NOT-FOUND)
    )
  )
)

(define-public (complete-match (match-id uint))
  (let ((match-opt (map-get? Matches { match-id: match-id })))
    (match match-opt
      m
      (begin
        (asserts! (contract-call? .VerificationOracle is-verified match-id) (err ERR-NOT-AUTHORIZED))
        (asserts! (is-eq (get status m) "matched") (err ERR-UPDATE-NOT-ALLOWED))
        (map-set Matches { match-id: match-id }
          {
            inventory-id: (get inventory-id m),
            request-id: (get request-id m),
            donor: (get donor m),
            recipient: (get recipient m),
            quantity: (get quantity m),
            drug-type: (get drug-type m),
            expiry-date: (get expiry-date m),
            distance: (get distance m),
            priority: (get priority m),
            status: "completed",
            timestamp: block-height
          }
        )
        (try! (contract-call? .IncentiveToken mint-reward (get donor m) (get quantity m)))
        (print { event: "match-completed", id: match-id })
        (ok true)
      )
      (err ERR-MATCH-NOT-FOUND)
    )
  )
)

(define-public (auto-match-urgent (request-id uint))
  (let
    (
      (request (unwrap! (contract-call? .RequestManager get-request request-id) (err ERR-INVALID-REQUEST)))
      (inventory-list (contract-call? .InventoryManager list-available-inventories (get drug-type request)))
      (urgency (get urgency request))
    )
    (asserts! urgency (err ERR-INVALID-URGENCY))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (fold find-urgent-match inventory-list { request-id: request-id, match-found: none })
  )
)

(define-private (find-urgent-match (inventory-id uint) (state { request-id: uint, match-found: (optional uint) }))
  (if (is-some (get match-found state))
    state
    (let
      (
        (request-id (get request-id state))
        (inventory (unwrap! (contract-call? .InventoryManager get-inventory inventory-id) state))
        (request (unwrap! (contract-call? .RequestManager get-request request-id) state))
        (quantity (min (get quantity inventory) (get quantity request)))
        (drug-type (get drug-type inventory))
        (expiry-date (get expiry-date inventory))
        (distance u500)
        (priority u10)
      )
      (if (and (is-eq (get drug-type inventory) (get drug-type request))
               (>= (get quantity inventory) (get quantity request))
               (> (get expiry-date inventory) block-height)
               (<= distance u1000))
        (let ((match-id (try! (create-match inventory-id request-id quantity drug-type expiry-date distance priority))))
          { request-id: request-id, match-found: (some match-id) }
        )
        state
      )
    )
  )
)

(define-public (get-match-count)
  (ok (var-get next-match-id))
)