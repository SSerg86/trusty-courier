"use client";

import { useState, useEffect } from "react";
import CryptoJS from "crypto-js";

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [view, setView] = useState("create"); // 'create', 'link', 'reveal', 'revealed', 'error'
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [secretOutput, setSecretOutput] = useState("");
  const [error, setError] = useState("");
  const [passwordReveal, setPasswordReveal] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [retrievedData, setRetrievedData] = useState<{
    encryptedData: string;
    passwordHash?: string;
  } | null>(null);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Dark Mode Logic ---
  useEffect(() => {
    if (isMounted) {
      const savedTheme = localStorage.getItem("theme");
      const darkMode = savedTheme === "dark";
      setIsDarkMode(darkMode);
      if (darkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    }
  }, [isMounted]);

  const handleThemeChange = () => {
    const darkMode = !isDarkMode;
    setIsDarkMode(darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  };

  // --- Toast Notification ---
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string) => {
    setToast(message);
  };

  // --- Main Logic ---
  useEffect(() => {
    if (isMounted && window.location.hash) {
      setView("reveal");
    }
  }, [isMounted]);

  const handleCreateLink = async () => {
    if (!secret) {
      showToast("Please enter a secret to share.");
      return;
    }

    const key = CryptoJS.lib.WordArray.random(32).toString();
    const encrypted = CryptoJS.AES.encrypt(secret, key).toString();

    let passwordHash;
    if (password) {
      passwordHash = CryptoJS.SHA256(password).toString();
    }

    const dataToStore = {
      encryptedData: encrypted,
      passwordHash: passwordHash,
    };

    try {
      const response = await fetch("/api/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToStore),
      });
      const { id } = await response.json();

      const newLink = `${window.location.origin}/?id=${id}#${btoa(key)}`;
      setLink(newLink);
      setView("link");
    } catch {
      setError("Could not create secret on the server.");
      setView("error");
    }
  };

  const handleRevealSecret = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    try {
      const response = await fetch(`/api/secret?id=${id}`);
      if (!response.ok) {
        throw new Error("Secret not found or already viewed.");
      }
      const data = await response.json();
      setRetrievedData(data); // Store fetched data in state

      if (data.passwordHash) {
        // Password is required, so we prompt for it
        setView("password_prompt");
      } else {
        // No password, decrypt immediately
        decryptAndShow(data.encryptedData);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to retrieve secret.");
      setView("error");
    }
  };

  const handleDecryptWithPassword = () => {
    const MAX_ATTEMPTS = 3;

    if (!retrievedData || !retrievedData.passwordHash) {
      setError("An unexpected error occurred.");
      setView("error");
      return;
    }

    const providedPasswordHash = CryptoJS.SHA256(passwordReveal).toString();
    if (providedPasswordHash !== retrievedData.passwordHash) {
      const newAttemptCount = passwordAttempts + 1;
      setPasswordAttempts(newAttemptCount);

      if (newAttemptCount >= MAX_ATTEMPTS) {
        // Destroy the secret
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        fetch("/api/secret", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        setError("Too many incorrect attempts. The secret has been destroyed.");
        setView("error");
      } else {
        setError(
          `Incorrect password. You have ${
            MAX_ATTEMPTS - newAttemptCount
          } attempts remaining.`
        );
      }
      return;
    }

    decryptAndShow(retrievedData.encryptedData);
  };

  const decryptAndShow = (encryptedData: string) => {
    try {
      const key = atob(window.location.hash.substring(1));
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
      const originalText = decrypted.toString(CryptoJS.enc.Utf8);
      if (!originalText) {
        throw new Error("Decryption failed. The key in the link is invalid.");
      }
      setSecretOutput(originalText);
      setView("revealed");
      history.replaceState(null, "", "/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to decrypt secret.");
      setView("error");
    }
  };

  const handleCreateNew = () => {
    setView("create");
    setSecret("");
    setPassword("");
    setLink("");
    setError("");
  };

  const copySecretToClipboard = () => {
    navigator.clipboard.writeText(secretOutput);
    showToast("Secret copied to clipboard!");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(link);
    showToast("Link copied to clipboard!");
  };

  if (!isMounted) {
    return null; // Or a loading spinner
  }

  return (
    <>
      <div className="theme-switch-wrapper">
        <label className="theme-switch" htmlFor="checkbox">
          <input
            type="checkbox"
            id="checkbox"
            checked={isDarkMode}
            onChange={handleThemeChange}
          />
          <div className="slider round"></div>
        </label>
      </div>

      <div id="app">
        {view === "create" && (
          <div id="create-view">
            <h1>Trusty Courier</h1>
            <p
              style={{
                marginTop: "-0.5rem",
                marginBottom: "1rem",
                color: "#7f8c8d",
              }}
            >
              Share secrets securely.
            </p>
            <textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter your secret here..."
            ></textarea>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Optional: Add a secret word for extra security..."
            />
            <button onClick={handleCreateLink}>Create Secure Link</button>
          </div>
        )}

        {view === "link" && (
          <div id="link-display">
            <h2>Your secure link is ready:</h2>
            <input type="text" value={link} readOnly />
            <button onClick={copyToClipboard}>Copy Link</button>
            <button onClick={handleCreateNew} className="secondary-button">
              Create New
            </button>
          </div>
        )}

        {view === "reveal" && (
          <div id="view-secret-view">
            <h1>You have received a secret</h1>
            <button id="reveal-btn" onClick={handleRevealSecret}>
              Reveal Secret
            </button>
          </div>
        )}

        {view === "password_prompt" && (
          <div id="password-prompt-view">
            <h1>Password Required</h1>
            <input
              type="password"
              value={passwordReveal}
              onChange={(e) => setPasswordReveal(e.target.value)}
              placeholder="Enter the secret word..."
            />
            <button
              onClick={handleDecryptWithPassword}
              disabled={!passwordReveal}
            >
              Decrypt
            </button>
            {error && (
              <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>
            )}
          </div>
        )}

        {view === "revealed" && (
          <div id="secret-display">
            <h2>The secret is:</h2>
            <div className="secret-output-wrapper">
              <p id="secret-output">{secretOutput}</p>
              <button
                onClick={copySecretToClipboard}
                className="copy-icon-button"
                title="Copy secret"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <button
              onClick={handleCreateNew}
              className="secondary-button"
              style={{ marginTop: "1.5rem" }}
            >
              Create Your Own Secret
            </button>
          </div>
        )}

        {view === "error" && (
          <div id="error-display">
            <h2>An Error Occurred</h2>
            <p>{error}</p>
          </div>
        )}
      </div>

      <div id="toast-container">
        {toast && <div className="toast show">{toast}</div>}
      </div>

      <div id="how-it-works">
        <h3>How This Works</h3>
        <p>
          This tool uses end-to-end encryption to keep your secrets safe. The
          password you set and the key to unlock the secret never leave your
          browser. We only store the encrypted data, which is permanently
          deleted from our server after it&apos;s viewed once.
        </p>
      </div>
    </>
  );
}
