import { Hash, SendTransactionParameters, TransactionReceipt, WalletClient } from "viem";
import { Config, useAccount, useSendTransaction } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { SendTransactionMutate } from "wagmi/query";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { AllowedChainIds, getBlockExplorerTxLink, notification } from "~~/utils/scaffold-eth";
import { TransactorFuncOptions, getParsedErrorWithAllAbis } from "~~/utils/scaffold-eth/contract";

type TransactionFunc = (
  tx: (() => Promise<Hash>) | Parameters<SendTransactionMutate<Config, undefined>>[0],
  options?: TransactorFuncOptions,
) => Promise<Hash | undefined>;

/**
 * Custom notification content for TXs.
 */
const TxnNotification = ({ message, blockExplorerLink }: { message: string; blockExplorerLink?: string }) => {
  return (
    <div className={`flex flex-col ml-1 cursor-default`}>
      <p className="my-0">{message}</p>
      {blockExplorerLink && blockExplorerLink.length > 0 ? (
        <a href={blockExplorerLink} target="_blank" rel="noreferrer" className="block link">
          check out transaction
        </a>
      ) : null}
    </div>
  );
};

/**
 * Runs Transaction passed in to returned function showing UI feedback.
 * @param _walletClient - Optional wallet client to use. If not provided, will use the one from useWalletClient.
 * @returns function that takes in transaction function as callback, shows UI feedback for transaction and returns a promise of the transaction hash
 */
export const useTransactor = (_walletClient?: WalletClient): TransactionFunc => {
  const { chainId } = useAccount();
  const { data: txHash, sendTransaction } = useSendTransaction();

  const result: TransactionFunc = async (tx, options) => {
    let notificationId = null;
    let transactionHash: Hash | undefined = undefined;
    let transactionReceipt: TransactionReceipt | undefined;
    let blockExplorerTxURL = "";
    try {
      const publicClient = getPublicClient(wagmiConfig);

      notificationId = notification.loading(<TxnNotification message="Awaiting for user confirmation" />);
      if (typeof tx === "function") {
        // Tx is already prepared by the caller
        const result = await tx();
        transactionHash = result;
      } else if (tx != null) {
        if (_walletClient) {
          transactionHash = await _walletClient.sendTransaction(tx as SendTransactionParameters);
        } else {
          sendTransaction(tx as SendTransactionParameters);
          transactionHash = txHash;
        }
      } else {
        throw new Error("Incorrect transaction passed to transactor");
      }
      notification.remove(notificationId);

      blockExplorerTxURL = chainId && transactionHash ? getBlockExplorerTxLink(chainId, transactionHash) : "";

      notificationId = notification.loading(
        <TxnNotification message="Waiting for transaction to complete." blockExplorerLink={blockExplorerTxURL} />,
      );

      if (!transactionHash) {
        throw new Error("Transaction hash is undefined");
      }

      transactionReceipt = await publicClient?.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: options?.blockConfirmations,
      });
      notification.remove(notificationId);

      if (!transactionReceipt) {
        throw new Error("Transaction receipt is undefined");
      }

      if (transactionReceipt.status === "reverted") throw new Error("Transaction reverted");

      notification.success(
        <TxnNotification message="Transaction completed successfully!" blockExplorerLink={blockExplorerTxURL} />,
        {
          icon: "🎉",
        },
      );

      if (options?.onBlockConfirmation && transactionReceipt) options.onBlockConfirmation(transactionReceipt);
    } catch (error: any) {
      if (notificationId) {
        notification.remove(notificationId);
      }
      console.error("⚡️ ~ file: useTransactor.ts ~ error", error);
      const message = getParsedErrorWithAllAbis(error, chainId as AllowedChainIds);

      // if receipt was reverted, show notification with block explorer link and return error
      if (transactionReceipt?.status === "reverted") {
        notification.error(<TxnNotification message={message} blockExplorerLink={blockExplorerTxURL} />);
        throw error;
      }

      notification.error(message);
      throw error;
    }

    return transactionHash;
  };

  return result;
};
