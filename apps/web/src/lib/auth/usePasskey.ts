import {
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type { User } from "@hously/shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setUser } from "@/lib/auth";
import { useFetcher } from "@/lib/api/context";
import { AUTH_ENDPOINTS } from "@/lib/endpoints";
import { queryKeys } from "@/lib/queryKeys";

export { browserSupportsWebAuthn };

interface PasskeyCredential {
  id: number;
  credential_id: string;
  name: string | null;
  device_type: string;
  backed_up: boolean;
  transports: string[];
  created_at: string;
}

interface CredentialsResponse {
  credentials: PasskeyCredential[];
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export function usePasskeyCredentials() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.auth.passkeyCredentials,
    queryFn: () =>
      fetcher<CredentialsResponse>(AUTH_ENDPOINTS.PASSKEY_CREDENTIALS),
  });
}

export function usePasskeyRegister() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name?: string) => {
      const options = await fetcher<PublicKeyCredentialCreationOptionsJSON>(
        AUTH_ENDPOINTS.PASSKEY_REGISTER_OPTIONS,
        { method: "POST" },
      );

      const attestation = await startRegistration({ optionsJSON: options });

      return fetcher<{ verified: boolean }>(
        AUTH_ENDPOINTS.PASSKEY_REGISTER_VERIFY,
        {
          method: "POST",
          body: { ...attestation, name: name ?? null },
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.passkeyCredentials,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useDeletePasskey() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialId: number) =>
      fetcher<{ success: boolean }>(
        `${AUTH_ENDPOINTS.PASSKEY_CREDENTIALS}/${credentialId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.passkeyCredentials,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function usePasskeyAuthenticate() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const options = await fetcher<PublicKeyCredentialRequestOptionsJSON>(
        AUTH_ENDPOINTS.PASSKEY_AUTHENTICATE_OPTIONS,
        { method: "POST" },
      );

      const assertion = await startAuthentication({ optionsJSON: options });

      return fetcher<AuthResponse>(AUTH_ENDPOINTS.PASSKEY_AUTHENTICATE_VERIFY, {
        method: "POST",
        body: assertion,
      });
    },
    onSuccess: (data) => {
      if (data.user) {
        setUser(data.user);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}
