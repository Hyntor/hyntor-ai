"""Validation for the tutor endpoints.

Every form here is strict: a request carrying a field the form does not declare is refused, not
quietly ignored. Django's default is to ignore extras, which is wrong for these endpoints. The tier
is decided by the server (TUT-3, #27), so a body arriving with `tier: 4`, `hint_tier` or
`max_tier_allowed` is an attempt to choose it, and the honest answer to an attempt is a refusal
rather than a success that happens not to have worked. The same goes for `mode` on a send: the mode
is fixed when the session is created and cannot change mid-session.
"""

from django import forms

from tutor.models import TutorMode
from tutor_chat.limits import MAX_MESSAGE_LENGTH


class StrictForm(forms.Form):
    """A form that refuses a body containing fields it does not declare.

    The refusal names the offending fields, so a caller sending the wrong shape is told what was
    wrong rather than having part of their request silently dropped.
    """

    def clean(self):
        cleaned = super().clean()
        unexpected = sorted(set(self.data) - set(self.fields))
        if unexpected:
            raise forms.ValidationError(
                "Unexpected field(s): %(fields)s.",
                code="unexpected_fields",
                params={"fields": ", ".join(unexpected)},
            )
        return cleaned


class StartSessionForm(StrictForm):
    """What a student chooses when opening a conversation. The mode cannot be changed afterwards."""

    course_id = forms.IntegerField(min_value=1)
    mode = forms.ChoiceField(choices=TutorMode.choices)


class SendMessageForm(StrictForm):
    """One student message, and nothing else. The tier is not the student's to send (#27)."""

    text = forms.CharField(max_length=MAX_MESSAGE_LENGTH)
