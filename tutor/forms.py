"""Validation for the tutor endpoints"""
from django import forms
 
from tutor.models import TutorMode
from tutor_chat.limits import MAX_MESSAGE_LENGTH
 
class StartSessionForm(forms.Form):
    """What a student chooses when opening a conversation, mode cannot be changed afterwards"""
    course_id = forms.IntegerField(min_value=1)
    mode = forms.ChoiceField(choices=TutorMode.choices)
 
 
class SendMessageForm(forms.Form):
    """Only one student message"""
    text = forms.CharField(max_length=MAX_MESSAGE_LENGTH)