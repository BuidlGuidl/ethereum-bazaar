"use client";

import { parseEther } from "viem";
import { useTransactor } from "~~/hooks/scaffold-eth/useTransactor";

export const PayButton = ({ to, valueEth, disabled }: { to: `0x${string}`; valueEth: string; disabled?: boolean }) => {
  const transactor = useTransactor();

  const pay = async () => {
    await transactor({
      to,
      value: parseEther(valueEth),
    });
  };

  return (
    <button className="btn btn-primary" onClick={pay} disabled={disabled}>
      Pay {valueEth} ETH
    </button>
  );
};
