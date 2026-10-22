import { useAuth } from "@/src/auth/AuthProvider";
import { AuthShell, FormError, OrDivider, PasswordField, SwitchLink } from "@/src/auth/AuthShell";
import { colors, type } from "@/src/theme";
import { Button, TextField } from "@/src/ui";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, canSignIn, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const problems = {
    name: name.trim().length < 2 ? "Enter your full name." : undefined,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : undefined,
    password: password.length < 8 ? "Use at least 8 characters." : undefined,
    confirm: confirm !== password ? "Passwords don't match." : undefined,
  };
  const valid = !problems.name && !problems.email && !problems.password && !problems.confirm;
  const show = (k: keyof typeof problems) => (touched ? problems[k] : undefined);

  const submit = async () => {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    const ok = await signUpWithEmail({ name, email, password });
    setBusy(false);
    if (ok) router.replace("/(auth)/verify-email");
  };

  return (
    <AuthShell title="Create your account" subtitle="Sign up with your work email to see your schedule and attendance.">
      {error ? <FormError body={error} /> : null}
      <TextField label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" autoCapitalize="words" autoComplete="name" error={show("name")} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@workplace.com"
        keyboardType="email-address"
        autoComplete="email"
        error={show("email")}
      />
      <PasswordField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        error={show("password")}
      />
      <PasswordField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        error={show("confirm")}
        onSubmitEditing={submit}
      />
      <Button label="Create account" onPress={submit} loading={busy} />
      <Text style={[type.tiny, { color: colors.muted, textAlign: "center" }]}>
        Creating an account only registers your email here. After you verify your address, an administrator must approve your
        account and assign your role before you can sign in.
      </Text>
      {canSignIn ? (
        <>
          <OrDivider />
          <Button label="Continue with Google" variant="secondary" onPress={signInWithGoogle} />
        </>
      ) : null}
      <SwitchLink prompt="Already have an account?" action="Log in" onPress={() => router.replace("/(auth)/login")} />
    </AuthShell>
  );
}
