import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Loader from "@/components/shared/Loader";
import { useToast } from "@/components/ui/use-toast";

import { SigninValidation } from "@/lib/validation";
import { useSignInAccount, useGetCurrentUser } from "@/lib/react-query/queries"; // Import useGetCurrentUser
import { useUserContext } from "@/context/AuthContext";
import { sendEmail } from "@/lib/utils";

const SigninForm = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { checkAuthUser, isLoading: isUserLoading } = useUserContext();

    const { mutateAsync: signInAccount, isLoading } = useSignInAccount();
    const { data: currentUser } = useGetCurrentUser(); // Get current user data

    const form = useForm<z.infer<typeof SigninValidation>>({
        resolver: zodResolver(SigninValidation),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const handleSignin = async (user: z.infer<typeof SigninValidation>) => {
        try {
            const session = await signInAccount({
    email: user.email,
    password: user.password,
});

            if (!session) {
                toast({ title: "Login failed. Please try again." });
                return;
            }

            const isLoggedIn = await checkAuthUser();

            if (isLoggedIn) {
                form.reset();

                try {
                    // Get user name from database if available
                    const userName = currentUser?.name || user.email; // Fallback to email if name is not found
                    await sendEmail(user.email, userName, 'signin');
                    toast({ title: "Login successful! Welcome back. A confirmation email has been sent." });
                } catch (emailError) {
                    console.error("Email sending error:", emailError);
                    toast({ title: "Login successful, but we were unable to send a confirmation email. Please check your email settings." });
                }

                navigate("/");
            } else {
                toast({ title: "Login failed. Please try again." });
            }
        } catch (error) {
            console.error("Signin error:", error);
            toast({ title: "An error occurred. Please try again later." });
        }
    };

    return (
        <Form {...form}>
            <div className="sm:w-420 flex-center flex-col">
                <img src="/assets/images/logo.svg" alt="logo" />

                <h2 className="h3-bold md:h2-bold pt-5 sm:pt-12">
                    Log in to your account
                </h2>
                <p className="text-light-3 small-medium md:base-regular mt-2">
                    Welcome back! Please enter your details.
                </p>
                <form
                    onSubmit={form.handleSubmit(handleSignin)}
                    className="flex flex-col gap-5 w-full mt-4"
                >
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }: { field: any }) => (
                            <FormItem>
                                <FormLabel className="shad-form_label">Email</FormLabel>
                                <FormControl>
                                    <Input type="text" className="shad-input" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="shad-form_label">Password</FormLabel>
                                <FormControl>
                                    <Input type="password" className="shad-input" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button type="submit" className="shad-button_primary">
                        {isLoading || isUserLoading ? (
                            <div className="flex-center gap-2">
                                <Loader /> Loading...
                            </div>
                        ) : (
                            "Log in"
                        )}
                    </Button>

                    <p className="text-small-regular text-light-2 text-center mt-2">
                        Don&apos;t have an account?
                        <Link
                            to="/sign-up"
                            className="text-primary-500 text-small-semibold ml-1"
                        >
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </Form>
    );
};

export default SigninForm;