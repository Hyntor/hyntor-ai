"""Routes for getting into and out of an account.

Two ways in - a password or Google - and one way out. The Google pair is a round trip: the browser
leaves for Google at /auth/google/ and comes back to /auth/google/callback/.
"""

from django.urls import path

from accounts import views

urlpatterns = [
    path("signup/", views.signup_view, name="signup"),
    path("auth/google/", views.google_start_view, name="google-start"),
    path("auth/google/callback/", views.google_callback_view, name="google-callback"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
]
