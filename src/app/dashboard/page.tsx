"use client";

import { BoardProvider, useBoard } from "../../lib/store";
import { Topbar } from "../../components/Topbar";
import { SprintBanner } from "../../components/SprintBanner";
import { FilterBar } from "../../components/FilterBar";
import { Board } from "../../components/Board";
import { NewIssueDialog } from "../../components/NewIssueDialog";
import { EditIssueDialog } from "../../components/EditIssueDialog";
import { DeleteIssueDialog } from "../../components/DeleteIssueDialog";
import { SprintSettingsDialog } from "../../components/SprintSettingsDialog";
import { AddColumnDialog, EditColumnDialog } from "../../components/ColumnDialogs";
import { Footer } from "../../components/Footer";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { ErrorPanel } from "../../components/ErrorPanel";
import { Toast } from "../../components/Toast";

function SessionSplash() {
  return (
    <main className="wrap">
      <div className="auth-wrap" style={{ padding: 0 }}>
        <div className="auth-card" role="status" aria-label="Checking session">
          <div className="auth-logo">
            <span className="logo-mark">M</span>
            <span>MYTHRIL</span>
          </div>
          <h1>Checking session</h1>
          <div className="skel" aria-hidden="true">
            <i className="short" />
            <i />
            <i />
          </div>
        </div>
      </div>
    </main>
  );
}

function NoAccess() {
  return (
    <div className="empty" role="status" style={{ padding: 32 }}>
      No access yet — projects you have access to will appear here once an admin assigns you.
    </div>
  );
}

function DashboardBody() {
  const { phase, switching, sessionStatus, projects, board, forbidden } = useBoard();
  if (sessionStatus === "loading" || sessionStatus === "anon") return <SessionSplash />;
  return (
    <>
      <Topbar />
      <main className="wrap" id="content">
        {phase === "loading" ? (
          <LoadingSkeleton />
        ) : phase === "error" ? (
          <ErrorPanel />
        ) : forbidden ? (
          <NoAccess />
        ) : projects.length === 0 || !board ? (
          <NoAccess />
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
      <EditIssueDialog />
      <DeleteIssueDialog />
      <SprintSettingsDialog />
      <AddColumnDialog />
      <EditColumnDialog />
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
