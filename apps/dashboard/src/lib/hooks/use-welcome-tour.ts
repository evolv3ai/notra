import { localStorageKeys } from "@/constants/storage";
import { WELCOME_TOUR_SEARCH_PARAM } from "@/constants/welcome-tour";
import { useStoredDismissal } from "@/lib/hooks/use-stored-dismissal";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";

/** Shows the welcome tour once, when onboarding hands off with `?welcome=1`. */
export function useWelcomeTour() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { dismissed, dismiss } = useStoredDismissal(
    localStorageKeys.welcomeTourSeen
  );
  const open =
    !dismissed && searchParams.get(WELCOME_TOUR_SEARCH_PARAM) === "1";

  const close = () => {
    dismiss();
    const params = new URLSearchParams(searchParams);
    params.delete(WELCOME_TOUR_SEARCH_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return { open, close };
}
