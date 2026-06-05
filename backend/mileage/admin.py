from django.contrib import admin

from .models import MileagePolicy, MileageTrip, MileageYTDTracker

admin.site.register(MileagePolicy)
admin.site.register(MileageTrip)
admin.site.register(MileageYTDTracker)
