import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, User, Brain, Palette, Mic, Bell } from "lucide-react";
import { SpotifyIntegration } from "@/components/SpotifyIntegration";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAssistant } from "@/lib/assistant-store";
import {
  getPersonalityById,
  personalityOptions,
  type PersonalityId,
} from "@/lib/assistant-settings";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Mistski" }] }),
  component: SettingsPage,
});

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "ai", label: "AI & memory", icon: Brain },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "integrations", label: "Integrations", icon: Bell },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const accents = ["violet", "cyan", "rose", "mint", "amber"];
const models = ["Misty default", "OpenAI GPT-5", "Anthropic Claude", "Google Gemini"];
const voices = [
  { value: "aura-2-callista-en", label: "Callista (Deepgram)" },
  { value: "aura-2-amalthea-en", label: "Aurora (Deepgram)" },
  { value: "kPzsL2i3teMYv0FxEYQ6", label: "ElevenLabs" },
  { value: "uYXf8XasLslADfZ2MB4u", label: "ElevenLabs Alt" },
  { value: "OoyEgl8TKTG1cottIv7z", label: "Friday" },
];

function SettingsPage() {
  const [active, setActive] = useState("profile");
  const [accent, setAccent] = useState("violet");
  const [model, setModel] = useState(models[0]);

  const preferredVoice = useAssistant((s) => s.preferredVoice);
  const setPreferredVoice = useAssistant((s) => s.setPreferredVoice);
  const voiceEnabled = useAssistant((s) => s.voiceEnabled);
  const setVoiceEnabled = useAssistant((s) => s.setVoiceEnabled);
  const personalityId = useAssistant((s) => s.personalityId);
  const setPersonality = useAssistant((s) => s.setPersonality);

  useEffect(() => {
    let mounted = true;

    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (!mounted || !settings) return;
        const loadedPersonality = getPersonalityById(settings.personalityId);
        const loadedVoice = loadedPersonality.voiceId ?? settings.preferredVoice;
        const loadedPrompt =
          loadedPersonality.id === "jarvis"
            ? loadedPersonality.prompt
            : settings.personalityPrompt || loadedPersonality.prompt;

        setVoiceEnabled(settings.voiceEnabled);
        setPreferredVoice(loadedVoice);
        setPersonality(loadedPersonality.id, loadedPrompt);

        if (loadedPersonality.id === "jarvis" && settings.personalityPrompt !== loadedPrompt) {
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personalityPrompt: loadedPrompt,
              preferredVoice: loadedVoice,
              voiceEnabled: settings.voiceEnabled,
            }),
          }).catch((error) => console.error("Failed to normalize assistant settings", error));
        }
      })
      .catch((error) => console.error("Failed to load assistant settings", error));

    return () => {
      mounted = false;
    };
  }, [setPersonality, setPreferredVoice, setVoiceEnabled]);

  const saveAssistantSettings = async (next: {
    personalityId?: PersonalityId;
    personalityPrompt?: string;
    preferredVoice?: string;
    voiceEnabled?: boolean;
  }) => {
    const currentPersonality = getPersonalityById(next.personalityId ?? personalityId);

    const body = {
      personalityPrompt: next.personalityPrompt ?? currentPersonality.prompt,
      preferredVoice: next.preferredVoice ?? preferredVoice,
      voiceEnabled: next.voiceEnabled ?? voiceEnabled,
    };

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(await response.text());
    } catch (error) {
      console.error("Failed to save assistant settings", error);
    }
  };

  const selectPersonality = (id: PersonalityId) => {
    const option = getPersonalityById(id);
    const nextVoice = option.voiceId ?? preferredVoice;

    setPersonality(option.id, option.prompt);
    setPreferredVoice(nextVoice);
    saveAssistantSettings({
      personalityId: option.id,
      personalityPrompt: option.prompt,
      preferredVoice: nextVoice,
    });
  };

  const selectVoice = (voice: string) => {
    setPreferredVoice(voice);
    saveAssistantSettings({ preferredVoice: voice });
  };

  const toggleVoice = (enabled: boolean) => {
    setVoiceEnabled(enabled);
    saveAssistantSettings({ voiceEnabled: enabled });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Make Misty yours.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <nav className="glass-card p-2 h-fit">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                active === s.id
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </nav>

        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 space-y-6"
        >
          {active === "profile" && (
            <>
              <Field label="Name">
                <div className="text-sm px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-foreground cursor-not-allowed opacity-80">
                  Not set
                </div>
              </Field>
              <Field label="Email">
                <div className="text-sm px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-foreground cursor-not-allowed opacity-80">
                  Not set
                </div>
              </Field>
              <Field label="Time zone">
                <div className="text-sm px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-foreground cursor-not-allowed opacity-80">
                  Not set
                </div>
              </Field>
            </>
          )}
          {active === "ai" && (
            <>
              <Field label="Model">
                <DropdownSelect
                  value={model}
                  options={models.map((m) => ({ value: m, label: m }))}
                  onChange={setModel}
                />
              </Field>
              <Field label="Personality">
                <div className="grid grid-cols-2 gap-2">
                  {personalityOptions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPersonality(p.id)}
                      className={`p-3 rounded-lg text-sm text-left border transition ${
                        personalityId === p.id
                          ? "bg-white/10 border-white/20"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/5"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Long-term memory">
                <Toggle defaultChecked label="Allow Misty to remember context across chats" />
              </Field>
            </>
          )}
          {active === "appearance" && (
            <>
              <Field label="Accent color">
                <div className="flex gap-3">
                  {accents.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAccent(a)}
                      aria-label={a}
                      className={`h-10 w-10 rounded-full border-2 transition ${accent === a ? "border-white scale-110" : "border-transparent"}`}
                      style={{
                        background: `oklch(0.78 0.18 ${a === "violet" ? 300 : a === "cyan" ? 220 : a === "rose" ? 10 : a === "mint" ? 165 : 80})`,
                      }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Theme">
                <div className="flex gap-2">
                  {["Dark", "Auto", "Light"].map((t) => (
                    <button
                      key={t}
                      className={`px-4 py-2 rounded-lg text-sm border ${t === "Dark" ? "bg-white/10 border-white/20" : "bg-white/[0.03] border-white/5"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}
          {active === "voice" && (
            <>
              <Field label="Voice replies">
                <Toggle
                  checked={voiceEnabled}
                  onChange={toggleVoice}
                  label="Speak responses out loud"
                />
              </Field>
              <Field label="Voice">
                <DropdownSelect value={preferredVoice} options={voices} onChange={selectVoice} />
              </Field>
            </>
          )}
          {active === "integrations" && (
            <>
              <Field label="Spotify">
                <SpotifyIntegration />
              </Field>
            </>
          )}
          {active === "notifications" && (
            <>
              <Field label="Daily summary">
                <Toggle defaultChecked label="Each evening at 9pm" />
              </Field>
              <Field label="Quiet hours">
                <Toggle defaultChecked label="No pings between 8pm and 8am" />
              </Field>
              <Field label="Habit reminders">
                <Toggle label="Gentle nudges for streaks" />
              </Field>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function DropdownSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full justify-between rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-normal text-foreground shadow-none hover:bg-white/10"
        >
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            <span className="flex-1">{option.label}</span>
            {option.value === value && <Check className="h-4 w-4 text-[color:var(--cyan)]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  defaultChecked,
  label,
  onChange,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
}) {
  const [localOn, setLocalOn] = useState(!!defaultChecked);
  const on = checked ?? localOn;
  const setOn = (next: boolean) => {
    if (checked === undefined) setLocalOn(next);
    onChange?.(next);
  };

  return (
    <button onClick={() => setOn(!on)} className="flex items-center gap-3 group">
      <div
        className={`w-10 h-6 rounded-full transition relative ${on ? "bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)]" : "bg-white/10"}`}
      >
        <div
          className={`absolute top-0.5 ${on ? "left-[18px]" : "left-0.5"} h-5 w-5 rounded-full bg-white transition-all`}
        />
      </div>
      <span className="text-sm text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}
