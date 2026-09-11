"use client";

import { BoardProvider, useBoard } from "../lib/store";
import { Topbar } from "../components/Topbar";
import { SprintBanner } from "../components/SprintBanner";
import { FilterBar } from "../components/FilterBar";
import { Board } from "../components/Board";
import { NewIssueDialog } from "../components/NewIssueDialog";
import { Footer } from "../components/Footer";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { ErrorPanel } from "../components/ErrorPanel";
import { Toast } from "../components/Toast";

function DashboardBody() {
  const { phase, switching } = useBoard();
  return (
    <>
      <Topbar />
      <main className="wrap" id="content">
        {phase === "loading" ? (
          <LoadingSkeleton />
        ) : phase === "error" ? (
          <ErrorPanel />
        ) : (
          <>
            <SprintBanner />
            <FilterBar />
            <div style={switching ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
              <Board />
            </div>
            <Footer />
          </>
        )}
      </main>
      <NewIssueDialog />
      <Toast />
    </>
  );
}

export default function Home() {
  return (
    <BoardProvider>
      <DashboardBody />
    </BoardProvider>
  );
}
