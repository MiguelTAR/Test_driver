import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validateEmail, validatePassword } from '@/utils/validation';
import { useAuth } from '@/context/auth-context';

const PRIMARY = '#2F5BD9';
const ERROR = '#D93025';

const SHOW_SIGN_UP = true;

type SymbolName = ComponentProps<typeof SymbolView>['name'];

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();

  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
  const nextEmailError = validateEmail(email);
  const nextPasswordError = validatePassword(password);

  setEmailError(nextEmailError);
  setPasswordError(nextPasswordError);

  if (nextEmailError || nextPasswordError) return;

  setIsSubmitting(true);
  try {
    await signIn(email.trim(), password);
    setFormError(null);
    router.replace('/(tabs)');
  } catch (error) {
    setFormError(error instanceof Error ? error.message : 'Unable to log in.');
  } finally {
    setIsSubmitting(false);
  }
}
  


  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Brand header */}
            <View style={styles.brandRow}>
              <View style={[styles.logo, { backgroundColor: PRIMARY }]}>
                <SymbolView
                  name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
                  size={22}
                  tintColor="#ffffff"
                />
              </View>
              <ThemedText type="smallBold" style={styles.brandText}>
                Driver Analytics
              </ThemedText>
            </View>

            {/* Title */}
            <ThemedText type="subtitle" style={styles.title}>
              Welcome Back!
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Log in to see your trips and driver score.
            </ThemedText>

            {formError && (
              <View style={[styles.formError, { borderColor: ERROR }]}>
                <ThemedText
                  type="small"
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={{ color: ERROR }}>
                  {formError}
                </ThemedText>
              </View>
            )}

            {/* Email */}
            <ThemedText type="smallBold" style={styles.label}>
              Email Address
            </ThemedText>
            <IconInput
              icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
              hasError={!!emailError}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(null);
                setFormError(null); // AC5.6
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isSubmitting}
              accessibilityLabel="Email"
            />
            {emailError && (
              <ThemedText type="small" style={{ color: ERROR }}>
                {emailError}
              </ThemedText>
            )}

            {/* Password */}
            <ThemedText type="smallBold" style={styles.label}>
              Password
            </ThemedText>
            <IconInput
              icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
              inputRef={passwordRef}
              hasError={!!passwordError}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(null);
                setFormError(null); // AC5.6
              }}
              placeholder="Your password"
              secureTextEntry={!showPassword} // AC2.2: characters are masked by default
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              editable={!isSubmitting}
              accessibilityLabel="Password"
              right={
                <Pressable
                  onPress={() => setShowPassword((visible) => !visible)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <SymbolView
                    name={
                      showPassword
                        ? { ios: 'eye', android: 'visibility', web: 'visibility' }
                        : { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
                    }
                    size={20}
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              }
            />
            {passwordError && (
              <ThemedText type="small" style={{ color: ERROR }}>
                {passwordError}
              </ThemedText>
            )}

          

            <View style={styles.spacer} />

            {/* Log in button */}
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: PRIMARY },
                (pressed || isSubmitting) && styles.buttonDimmed,
              ]}>
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" /> // AC3.2: loading indicator
              ) : (
                <View style={styles.buttonContent}>
                  <ThemedText style={styles.buttonText}>Log in</ThemedText>
                  <SymbolView
                    name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                    size={18}
                    tintColor="#ffffff"
                  />
                </View>
              )}
            </Pressable>

            {SHOW_SIGN_UP && (
              <View style={styles.footer}>
                <ThemedText type="small" themeColor="textSecondary">
                  Don&apos;t have an account?{' '}
                </ThemedText>
                <Pressable onPress={() => router.push('/register' as never)} accessibilityRole="button">
                  <ThemedText type="smallBold" style={{ color: PRIMARY }}>
                    Sign Up
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** A rounded input with an icon on the left and an optional element (like the eye) on the right. */
function IconInput({
  icon,
  right,
  inputRef,
  hasError,
  ...inputProps
}: TextInputProps & {
  icon: SymbolName;
  right?: ReactNode;
  inputRef?: Ref<TextInput>;
  hasError?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: hasError ? ERROR : theme.backgroundSelected,
        },
      ]}>
      <SymbolView name={icon} size={20} tintColor={theme.textSecondary} />
      <TextInput
        ref={inputRef}
        placeholderTextColor={theme.textSecondary}
        style={[styles.fieldInput, { color: theme.text }]}
        {...inputProps}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: 480 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 16 },
  title: { fontSize: 30, lineHeight: 38 },
  subtitle: { marginBottom: Spacing.three },
  formError: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  label: { marginTop: Spacing.two },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    minHeight: 54,
  },
  fieldInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  forgot: { alignSelf: 'flex-end', paddingVertical: Spacing.one },
  spacer: { flexGrow: 1, minHeight: Spacing.four },
  button: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDimmed: { opacity: 0.7 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
});