import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Swap } from "../target/types/swap";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  type TOKEN_PROGRAM_ID,

} from "@solana/spl-token";

import { randomBytes } from 'node:crypto';

import { confirmTransaction, createAccountsMintsAndTokenAccounts, makeKeypairs } from "@solana-developers/helpers"
import { BN } from "bn.js";
import { assert } from "node:console";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
  TOKEN_2022_PROGRAM_ID; 

// Tests must complete within half this time otherwise
// they are marked as slow. Since Anchor involves a little
// network IO, these tests usually take about 15 seconds.
const SECONDS = 1000;
const ANCHOR_SLOW_TEST_THRESHOLD = 40 * SECONDS;

describe("swap", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const user = (provider.wallet as anchor.Wallet).payer;
    const payer = user;

    const connection = provider.connection;
    const program = anchor.workspace.Swap as Program<Swap>;

    const accounts: Record<string, PublicKey> = {
        tokenProgram: TOKEN_PROGRAM
    }

    let alice: anchor.web3.Keypair;
    let bob: anchor.web3.Keypair;
    let tokenMintA: anchor.web3.Keypair;
    let tokenMintB: anchor.web3.Keypair;

    // [alice, bob, tokenMintA, tokenMintB] = makeKeypairs(4);

    const tokenAOfferedAmount = new BN(1_000_000);
    const tokenBWantedAmount = new BN(1_000_000);

    before(
      "Creates Alice and Bob accounts, 2 token mints, and associatesd token accounts for users"
      , async () =>{
        
        const usersMintsAndTokenAccounts = 
          await createAccountsMintsAndTokenAccounts(
            [ 
              // ALICE 
              [ // tokenA amount
                1_000_000_000,
                0,  // tokenB amount
              ],
              // BOB

              [ // tokenA amount
                0,
                1_000_000_000,  // tokenB amount
              ]
            ],
            1* LAMPORTS_PER_SOL,
            connection,
            payer
          );
        
          const users = usersMintsAndTokenAccounts.users;
          alice = users[0];
          bob = users[1];

          const mints = usersMintsAndTokenAccounts.mints;
          tokenMintA = mints[0];
          tokenMintB = mints[1];

          const tokenAccounts = usersMintsAndTokenAccounts.tokenAccounts;
          const aliceTokenAccountA = tokenAccounts[0][0];
          const aliceTokenAccountB = tokenAccounts[0][1];

          const bobTokenAccountA = tokenAccounts[1][0];
          const bobTokenAccountB = tokenAccounts[1][1];

          // save this accounts 
          accounts.maker = alice.publicKey;
          accounts.taker = bob.publicKey;
          accounts.tokenMintA = tokenMintA.publicKey;
          accounts.tokenMintB = tokenMintB.publicKey;
          accounts.makerTokenAccountA = aliceTokenAccountA;
          accounts.makerTokenAccountB = aliceTokenAccountB;
          accounts.takerTokenAccountA = bobTokenAccountA;
          accounts.takerTokenAccountB = bobTokenAccountB;
      }
    );

    it("Puts the tokens Alice offers into the vault when Alice makes an offer", 
      async ()=> {
        const offerId = new BN(randomBytes(8));

        const offer = PublicKey.findProgramAddressSync(
          [
            Buffer.from("offer"),
            accounts.maker.toBuffer(),
            offerId.toArrayLike(Buffer, "le", 8)
          ],
          program.programId
        )[0];

        const vault = getAssociatedTokenAddressSync(
          accounts.tokenMintA,
          offer,
          true,
          TOKEN_PROGRAM
        );

        accounts.offer = offer;
        accounts.vault = vault;

        const transactionSignature = await program.methods.makeOffer(
          offerId,
          tokenAOfferedAmount,
          tokenBWantedAmount,
        )
        .accounts({ ...accounts})
        .signers([alice])
        .rpc();

        await confirmTransaction(connection, transactionSignature);
        
        // check the balance of the vault 
        const vaultBalanceResponse = await connection.getTokenAccountBalance(vault);
        const vaultBalance = new BN(vaultBalanceResponse.value.amount);
        assert(vaultBalance.eq(tokenAOfferedAmount))


        const offerAccount = await program.account.offer.fetch(offer);

        assert(offerAccount.maker.equals(alice.publicKey));
        assert(offerAccount.tokenBWantedAmount.eq(tokenBWantedAmount));
        assert(offerAccount.tokenMintA.equals(tokenMintA.publicKey));
        assert(offerAccount.tokenMintB.equals(tokenMintB.publicKey));
          
      }
    );

    it("Puts the tokens from the vault into Bob's account, and gives Alice Bob's tokens",
      async ()=>{
        const transactionSignature = await program.methods
        .takeOffer()
        .accounts({ ...accounts})
        .signers([bob])
        .rpc();

        await confirmTransaction(connection, transactionSignature);

        // check the balance of bob and alice 
        const aliceTokenAccountB = await connection.getTokenAccountBalance(accounts.makerTokenAccountB);
        const bobTokenAccountA = await connection.getTokenAccountBalance(accounts.takerTokenAccountA);

        const aliceTokenAccountBAmount = new BN(aliceTokenAccountB.value.amount);
        const bobTokenAccountAAmount = new BN(bobTokenAccountA.value.amount);

        assert(aliceTokenAccountBAmount.eq(tokenBWantedAmount));
        assert(bobTokenAccountAAmount.eq(tokenAOfferedAmount));
      }
    ).slow(ANCHOR_SLOW_TEST_THRESHOLD);

});
