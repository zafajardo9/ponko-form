import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/tanstack-react-start";

const signInButtonAppearance = {
  elements: {
    formButtonPrimary:
      "rounded-md bg-transparent hover:bg-[#faf9f5] text-[#141413] border border-[#e6dfd8] shadow-none",
  },
};

const signUpButtonAppearance = {
  elements: {
    formButtonPrimary:
      "rounded-md bg-[#cc785c] hover:bg-[#a9583e] text-white border-none shadow-none",
  },
};

const userButtonAppearance = {
  elements: {
    userButtonPopoverCard: "rounded-md border border-[#e6dfd8] bg-white shadow-md",
    userButtonPopoverActionButton:
      "text-[#141413] hover:bg-[#faf9f5] hover:text-[#141413]",
    userButtonPopoverActionButtonText: "text-[#141413]",
    userButtonPopoverFooter: "border-t border-[#e6dfd8]",
  },
};

export default function HeaderUser() {
  return (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-2">
          <SignInButton mode="modal" appearance={signInButtonAppearance} />
          <SignUpButton mode="modal" appearance={signUpButtonAppearance} />
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton appearance={userButtonAppearance} />
      </Show>
    </>
  );
}
