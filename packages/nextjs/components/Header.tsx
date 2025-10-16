"use client";

import React, { useRef } from "react";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BackButton from "./BackButton";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { Bars3Icon, BugAntIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"] });

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "All Locations",
    href: "/?home=1",
  },
  {
    label: "Debug Contracts",
    href: "/debug",
    icon: <BugAntIcon className="h-4 w-4" />,
  },
];

export const HeaderMenuLinks = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const pathname = usePathname();
  const { address } = useAccount();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        if (label === "Debug Contracts" && !isLocalNetwork) return null;
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "bg-secondary shadow-md" : ""
              } hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full gap-2 grid grid-flow-col`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
      {address ? (
        <li>
          <Link
            href={`/user/${address}/review`}
            passHref
            className={`$${false ? "bg-secondary shadow-md" : ""} hover:bg-secondary hover:shadow-md focus:!bg-secondary active:!text-neutral py-1.5 px-3 text-sm rounded-full gap-2 grid grid-flow-col`}
          >
            <span>Recent Activity</span>
          </Link>
        </li>
      ) : null}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-0 shrink-0 justify-between z-20 px-0 sm:px-2">
      <div className="navbar-start w-auto lg:w-1/2 flex items-center gap-1">
        <BackButton />
        <Link href="/?home=1" passHref className="hidden lg:flex items-center gap-1 ml-4 mr-3 shrink-0">
          <div className="flex items-center">
            <Image
              alt="Ethereum Bazaar logo"
              width={64}
              height={64}
              className="cursor-pointer"
              src="/ethereum-bazaar-logo.svg"
            />
          </div>
          <div className="flex flex-col">
            <span
              className={`${cormorant.className} font-semibold leading-tight text-[1.35rem] tracking-[0.01em] text-primary`}
            >
              Ethereum Bazaar
            </span>
            <span className="text-xs text-neutral/80">A peer to peer marketplace</span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-1 gap-2">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
        {/* Removed Add Mini App button; auto-prompt handled in provider */}
        <details className="dropdown dropdown-end" ref={burgerMenuRef}>
          <summary className="btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-sm bg-base-100 rounded-box w-52"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
      </div>
    </div>
  );
};
