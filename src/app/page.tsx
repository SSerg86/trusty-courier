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
      try {
        const decodedData = atob(window.location.hash.substring(1));
        const parts = decodedData.split(":::");
        setIsPasswordProtected(parts[0] === "p_true");
      } catch (e) {
        setError("Invalid link format.");
        setView("error");
      }
    }
  }, [isMounted]);

  const handleCreateLink = async () => {
    if (!secret) {
      showToast("Please enter a secret to share.");
      return;
    }

    let encrypted;
    let finalKey;
    let isPwdProtected = false;

    if (password) {
      finalKey = password;
      encrypted = CryptoJS.AES.encrypt(secret, finalKey).toString();
      isPwdProtected = true;
    } else {
      finalKey = CryptoJS.lib.WordArray.random(32).toString();
      encrypted = CryptoJS.AES.encrypt(secret, finalKey).toString();
    }

    const dataToStore = {
      encryptedData: encrypted,
    };

    try {
      const response = await fetch("/api/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToStore),
      });
      const { id } = await response.json();

      const dataToEncodeInUrl = isPwdProtected
        ? `p_true`
        : `p_false:::${finalKey}`;
      const newLink = `${window.location.origin}/?id=${id}#${btoa(
        dataToEncodeInUrl
      )}`;
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
      const { encryptedData } = await response.json();

      if (isPasswordProtected) {
        // Decrypt with user-provided password
        const decrypted = CryptoJS.AES.decrypt(encryptedData, passwordReveal);
        const originalText = decrypted.toString(CryptoJS.enc.Utf8);
        if (!originalText)
          throw new Error("Decryption failed. Incorrect password.");
        setSecretOutput(originalText);
      } else {
        // Decrypt with key from URL
        const key = atob(window.location.hash.substring(1)).split(":::")[1];
        const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
        const originalText = decrypted.toString(CryptoJS.enc.Utf8);
        setSecretOutput(originalText);
      }
      setView("revealed");
      history.replaceState(null, "", "/");
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to retrieve or decrypt secret."
      );
      setView("error");
    }
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
          </div>
        )}

        {view === "reveal" && (
          <div id="view-secret-view">
            <h1>You have received a secret</h1>
            {isPasswordProtected && (
              <div id="password-prompt">
                <h2>This secret is password-protected.</h2>
                <input
                  type="password"
                  value={passwordReveal}
                  onChange={(e) => setPasswordReveal(e.target.value)}
                  placeholder="Enter the secret word..."
                />
              </div>
            )}
            <button id="reveal-btn" onClick={handleRevealSecret}>
              Reveal Secret
            </button>
          </div>
        )}

        {view === "revealed" && (
          <div id="secret-display">
            <h2>The secret is:</h2>
            <p id="secret-output">{secretOutput}</p>
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
