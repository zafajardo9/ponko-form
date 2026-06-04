import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/tanstack-react-start";

export default function HeaderUser() {
  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
